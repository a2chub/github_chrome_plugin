# 設計: Stale-While-Revalidate による初期表示高速化

## 1. アーキテクチャ概要

### 現状の問題

GitHubダッシュボードのカスタマイズ表示において、ページアクセスごとにGitHub APIからのデータ取得完了を待機するため、数秒以上の空白時間が発生している。

| # | 問題 | 箇所 | 影響 |
|---|------|------|------|
| 1 | `saveDashboardSnapshot()` が未呼出 | どこからも呼ばれていない | `renderCachedDashboardData()` が常にnullを返し、即時表示が機能しない |
| 2 | API取得が逐次実行 | `message-handlers.ts:177-193` | repositories → issues → projects の直列実行で合計待機時間が増大 |
| 3 | 期限切れキャッシュの即時削除 | `cache-manager.ts:66-70` | staleデータを即時表示に活用できない |
| 4 | `fetchAndRenderData()` のawait | `content-script.ts:126` | API取得完了まで後続処理がブロックされる |

### 解決策: Stale-While-Revalidate パターン

**原則**: 古いデータでも「何も表示されない」より良い。

キャッシュ済みデータ（stale）を即座に表示し、バックグラウンドでAPIから最新データを取得（revalidate）する。取得完了後にUIを差し替える。

### 全体フロー

```
ページアクセス
  │
  ├─ (1) スナップショットを読み込み → キャッシュデータで即座にUI描画
  │
  └─ (2) バックグラウンドでAPI取得（fire-and-forget）
       │
       ├─ 3つのAPI呼び出しをPromise.allで並列実行
       │
       ├─ 成功 → UIを最新データで更新 + スナップショット保存
       │
       └─ 失敗 → staleデータをそのまま表示（エラーをヘッダーに通知）
```

### 詳細フロー図

```
[ユーザーがページを開く]
         │
    loadSettings()
         │
    applyLayout() ── レイアウト骨格を構築
         │
    renderCachedDashboardData()
         │
    ┌────┴────┐
    │ snapshot │
    │ あり?    │
    ├─ YES ────┤──→ 即座にキャッシュデータを描画
    │          │    ヘッダー: 「最新データを取得中...」
    ├─ NO ─────┤──→ ローディングスピナー表示のまま
    └──────────┘
         │
    fetchAndRenderData()  ← awaitなし（fire-and-forget）
         │
    [Service Worker: handleGetData()]
         │
    Promise.all([repos, issues, projects])  ← 並列実行
         │
    ┌────┴────┐
    │ 成功?   │
    ├─ YES ───┤──→ renderData() でUI更新
    │         │    saveDashboardSnapshot() でスナップショット保存
    │         │    ヘッダーローディング非表示
    ├─ NO ────┤──→ キャッシュ表示中ならそのまま維持 + ヘッダーにエラー通知
    │         │    キャッシュなしならエラーメッセージ表示
    └─────────┘
```

## 2. 各ファイルの変更内容

### 2.1 cache-manager.ts — `getStale<T>(key)` メソッド追加

**目的**: 期限切れでもデータを返却できるメソッドを追加する。

**変更方針**:
- 既存の `get<T>()` は変更しない（期限切れ時の削除動作はキャッシュの正当な振る舞い）
- 新しい `getStale<T>(key)` メソッドを追加する

**`getStale<T>()` の仕様**:

| 状態 | 返却値 | 副作用 |
|------|--------|--------|
| キャッシュが存在し、期限内 | `{ data: T, isStale: false }` | なし |
| キャッシュが存在し、期限切れ | `{ data: T, isStale: true }` | **削除しない** |
| キャッシュが存在しない | `null` | なし |
| ストレージエラー | `null` | エラーログ |

**返却型**:

```typescript
export interface StaleResult<T> {
  data: T;
  isStale: boolean;
}
```

**実装方針**:

```typescript
async getStale<T>(key: string): Promise<StaleResult<T> | null> {
  const cacheKey = this.getCacheKey(key);
  try {
    const entry = await getData<CacheEntry<T>>(cacheKey);
    if (!entry) {
      logger.debug(`Cache miss (stale): ${key}`);
      return null;
    }

    const age = Date.now() - entry.timestamp;
    const isStale = age > entry.ttl;

    logger.debug(
      `Cache getStale: ${key} (age: ${Math.floor(age / 1000)}s, stale: ${isStale})`
    );

    return { data: entry.data, isStale };
  } catch (error) {
    logger.error(`Failed to get stale cache for key "${key}":`, error);
    return null;
  }
}
```

**設計判断**: `get()` を変更してオプションで挙動を切り替える案も検討したが、以下の理由で別メソッドとした:
- `get()` の既存呼び出し元（`github-api.ts` の各fetch関数）はTTL準拠のままである必要がある
- メソッドを分離することで意図が明確になり、誤用を防げる

**注意**: `StaleResult` 型は `cache-manager.ts` 内でエクスポートする。`types/settings.ts` への追加は不要。

---

### 2.2 content-script.ts — 4 つの変更

#### 変更 A: `applyCustomizations()` — await を外す

**現在** (`content-script.ts:126`):
```typescript
await fetchAndRenderData();
```

**変更後**:
```typescript
fetchAndRenderData();
```

**理由**: API 取得完了を待たずに関数を終了させる。これにより、キャッシュデータが表示された状態でユーザーが操作を開始でき、バックグラウンドでデータが更新される。

**安全性**: `fetchAndRenderData()` 内部で既に try/catch/finally でエラーハンドリングを完結しているため、未処理の Promise rejection は発生しない。

#### 変更 B: `renderCachedDashboardData()` — ヘッダーメッセージの改善

**現在** (`content-script.ts:341`):
```typescript
setHeaderLoadingState(true, 'キャッシュされたデータを表示しています…');
```

**変更後**:
```typescript
setHeaderLoadingState(true, '最新データを取得中…');
```

**理由**: ユーザーに対しては「キャッシュを表示している」という技術的事実より、「最新データに更新中である」というユーザーの関心に沿ったメッセージが適切。

#### 変更 C: `fetchAndRenderData()` — スナップショット保存を追加

**現在** (`content-script.ts:250-256`):
```typescript
if (response.success) {
  // ...
  await renderData(response.data);
}
```

**変更後**:
```typescript
if (response.success) {
  // ...
  await renderData(response.data);
  // 追加: 次回アクセス時の即時表示用にスナップショット保存
  saveDashboardSnapshotFromData(response.data);
}
```

**`saveDashboardSnapshotFromData()` ヘルパー関数を content-script.ts 内に追加**:

```typescript
import { saveDashboardSnapshot } from '../utils/storage';
import { CachedDashboardSnapshot } from '../types/settings';

function saveDashboardSnapshotFromData(data: {
  repositories?: GroupedRepository[];
  issues?: Issue[];
  projects?: Project[];
}): void {
  const now = Date.now();
  const snapshot: CachedDashboardSnapshot = {};

  if (data.repositories) {
    snapshot.repositories = { data: data.repositories, updatedAt: now };
  }
  if (data.issues) {
    snapshot.issues = { data: data.issues, updatedAt: now };
  }
  if (data.projects) {
    snapshot.projects = { data: data.projects, updatedAt: now };
  }

  // fire-and-forget: 保存失敗は致命的でないためawaitしない
  // saveDashboardSnapshot() 内部でエラーログが出力される
  saveDashboardSnapshot(snapshot);
}
```

#### 変更 D: `fetchAndRenderData()` — stale データ表示中のエラーハンドリング改善

**現在**: エラー時は無条件に `showDataError()` を呼び、セクション内のデータをエラーメッセージで上書きしている。

**変更後**: キャッシュデータが表示されている場合は、セクションのエラー表示を避け、ヘッダーのローディングを非表示にするだけに留める。

```typescript
// fetchAndRenderData() 内、エラーハンドリング部分:

} else {
  if (hasCachedDataDisplayed()) {
    // staleデータが表示中 → データはそのまま維持
    logger.warn('API fetch failed, keeping stale data displayed:', response.error);
  } else {
    // キャッシュなし → 従来通りセクションにエラー表示
    showDataError(response.error || 'データの取得に失敗しました');
  }
}
// catch 節も同様のパターンで分岐
```

**`hasCachedDataDisplayed()` の判定方法**:

```typescript
function hasCachedDataDisplayed(): boolean {
  const sections = ['section-repositories', 'section-issues', 'section-projects'];
  return sections.some(id => {
    const section = document.getElementById(id);
    if (!section) return false;
    const content = section.querySelector('.section-content');
    if (!content) return false;
    // ローディング要素のみの場合はキャッシュ未表示と判定
    return content.children.length > 0
      && !content.querySelector('.loading-element');
  });
}
```

---

### 2.3 message-handlers.ts — API 呼び出しの並列化

**変更箇所**: `handleGetData()` 関数（`message-handlers.ts:176-193`）

**現在**: `dataType === 'all'` の場合でも 3 つの fetch を逐次実行している。

**変更後**: `dataType === 'all'` の場合は `Promise.all` で並列実行する。

```typescript
async function handleGetData(message: Message) {
  // ... token check, client init (変更なし) ...

  const dataType = message.dataType;
  const result: { repositories?: unknown[]; issues?: unknown[]; projects?: unknown[] } = {};

  if (dataType === 'all') {
    // 全データ取得: 並列実行
    const [repositories, issues, projects] = await Promise.all([
      fetchRepositories(client, cache),
      fetchMentionedIssues(client, cache),
      fetchProjects(client, cache),
    ]);

    result.repositories = applyRepositoryPreferences(repositories, repositoryPreferences);
    result.issues = sortIssuesByUpdated(issues);
    result.projects = sortProjectsByUpdated(projects);
  } else {
    // 個別データ取得: 従来通り
    if (dataType === 'repositories') {
      const repositories = await fetchRepositories(client, cache);
      result.repositories = applyRepositoryPreferences(repositories, repositoryPreferences);
    }
    if (dataType === 'issues') {
      const issues = await fetchMentionedIssues(client, cache);
      result.issues = sortIssuesByUpdated(issues);
    }
    if (dataType === 'projects') {
      const projects = await fetchProjects(client, cache);
      result.projects = sortProjectsByUpdated(projects);
    }
  }

  return result;
}
```

**注意**: `handleValidateToken()` （`message-handlers.ts:123`）では既に `Promise.all` が使用されている。`handleGetData()` も同じパターンに統一する。

---

## 3. ローディング状態の UX フロー

### パターン A: キャッシュあり（2回目以降のアクセス）

```
時間 → ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[レイアウト構築]
  │ ~50ms
[キャッシュデータで即座に描画]
  │ ヘッダー: 「最新データを取得中...」（スピナーあり）
  │
  │  ← ユーザーはこの時点で操作可能
  │
  │ ~1-3秒（API通信）
  │
[最新データで上書き描画]
  │ ヘッダー: ローディング非表示
  │ スナップショット保存（バックグラウンド）
```

**ユーザー体感**: ページを開いた瞬間にデータが見え、しばらくして最新データに切り替わる。

### パターン B: キャッシュなし（初回アクセス）

```
時間 → ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[レイアウト構築]
  │ 各セクション内にローディングスピナー表示
  │ ヘッダー: 「最新データを取得中...」
  │
  │ ~1-3秒（API通信）
  │
[データ描画]
  │ ヘッダー: ローディング非表示
  │ スナップショット保存（バックグラウンド）
```

**ユーザー体感**: 従来と同じだが、API 並列化により待ち時間が短縮される。

### パターン C: キャッシュあり + API エラー

```
時間 → ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[レイアウト構築]
  │
[キャッシュデータで即座に描画]
  │ ヘッダー: 「最新データを取得中...」
  │
  │ ~数秒（API通信 → 失敗）
  │
[staleデータをそのまま維持]
  │ ヘッダー: ローディング非表示
  │ ※セクション内のデータは消さない
```

**ユーザー体感**: データは古いが表示されたまま。白紙画面にはならない。

### ローディングメッセージの使い分け

| 状態 | メッセージ |
|------|-----------|
| キャッシュ描画後、API取得中 | `最新データを取得中…` |
| キャッシュなし、API取得中 | `最新データを取得中…`（変更 B により統一） |

---

## 4. エッジケースの考慮

### 4.1 初回起動（キャッシュ・スナップショットなし）

- `getDashboardSnapshot()` → null → `renderCachedDashboardData()` は何もしない
- 各セクションの初期ローディングスピナーがそのまま表示される
- `fetchAndRenderData()` が完了後にデータ描画 + スナップショット保存
- **対処**: 現行と同じ動作。パフォーマンス改善は API 並列化による短縮のみ。

### 4.2 トークン未設定

- `applyCustomizations()` 内で、トークンチェックは `renderCachedDashboardData()` の **後** に行われる
- トークン未設定の場合、`showTokenRequiredBanner()` が呼ばれ `fetchAndRenderData()` は実行されない
- **対処**: 現行と同じ動作。変更不要。

### 4.3 API エラー（stale データ表示中）

- stale データが描画済みの場合、`showDataError()` でセクション内容を上書きしない（変更 D）
- ヘッダーのローディング表示を非表示にするのみ
- stale データなしの場合は従来通りエラーメッセージを表示
- **対処**: 変更 D で対応。

### 4.4 レイアウト切り替え中のデータ取得

- `fetchAndRenderData()` は `isFetchingData` フラグで重複実行を防止している（既存）
- `teardownCustomLayout()` が呼ばれた場合、`isFetchingData = false` にリセットされる（既存）
- `fetchAndRenderData()` 内部で `isCustomLayoutActive` をチェックし、無効化されていたらレンダリングをスキップする（既存 `content-script.ts:252`）
- **対処**: 既存のガード条件で安全に動作する。fire-and-forget に変更しても影響なし。

### 4.5 設定変更による再描画 (`handleSettingsUpdated`)

- `handleSettingsUpdated()` 内の `fetchAndRenderData()` は **await のまま維持する**
- 理由: 設定変更時はユーザーが意図的にリフレッシュを期待しているため、完了を待つのが自然
- この関数は `applyCustomizations()` とは独立したコードパスなので、今回の変更に影響されない

### 4.6 `REFRESH_DATA` 時のスナップショット削除

- `handleRefreshData()` で `removeDashboardSnapshot()` が呼ばれる（既存）
- リフレッシュ後はキャッシュもスナップショットもクリアされるため、次回アクセスは「初回起動」と同じフローになる
- **対処**: 現行の動作で問題なし。

### 4.7 スナップショットのデータが古すぎる場合

- スナップショットにはTTLの概念がない（永続保存）
- 極端に古いデータが表示される可能性がある
- **対処**: 初期実装では許容する。スナップショットはAPI取得完了後に必ず上書きされるため、staleデータの表示時間は数秒程度。

---

## 5. 変更しない範囲

| 項目 | 理由 |
|------|------|
| メッセージ型（`types/messages.ts`） | 新しいメッセージタイプは不要。既存の `GET_DATA` フローで十分 |
| `CachedDashboardSnapshot` 型 | 既に適切な構造。変更不要 |
| `CacheManager.get()` の動作 | 期限切れ時の削除は正当なキャッシュ動作。`getStale()` を別メソッドで追加 |
| `handleSettingsUpdated()` の await | 設定変更時の await は意図的な待機であり、変更不要 |
| `handleValidateToken()` の `Promise.all` | 既に並列化済み |
| `github-api.ts` | フェッチ関数自体の変更は不要 |
| `layout-renderer.ts` | レイアウト構築ロジックの変更は不要 |
| `storage.ts` の既存関数 | `saveDashboardSnapshot` / `getDashboardSnapshot` はそのまま使用 |
| 型定義の大幅変更 | 既存の`CachedSection<T>` 型で要件を満たしている |

---

## 6. 変更対象ファイルまとめ

| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------|
| `src/utils/cache-manager.ts` | メソッド追加 | `getStale<T>()` メソッド追加、`StaleResult<T>` 型エクスポート |
| `src/content/content-script.ts` | ロジック変更 | await除去、スナップショット保存追加、エラーハンドリング改善、ヘッダーメッセージ変更、import追加 |
| `src/background/message-handlers.ts` | ロジック変更 | `handleGetData()` の `dataType === 'all'` 時の `Promise.all` 並列化 |

変更なし: `github-api.ts`, `storage.ts`, `types/messages.ts`, `types/settings.ts`, `layout-renderer.ts`

---

## 7. 実装順序

1. **cache-manager.ts**: `getStale()` メソッド追加（他の変更に依存しない）
2. **message-handlers.ts**: `handleGetData()` の並列化（他の変更に依存しない）
3. **content-script.ts**: await除去、スナップショット保存追加、エラーハンドリング改善

ステップ1と2は並列で実装可能。ステップ3はスナップショット機構（`getDashboardSnapshot()` / `saveDashboardSnapshot()`）を使用するため、1・2に依存しないが、全体の動作確認はすべて完了後に行う。

---

## 8. 補足: `getStale()` の位置づけ

本設計ではスナップショット機構（`saveDashboardSnapshot` / `getDashboardSnapshot`）を主軸としてstaleデータの即時表示を実現する。`getStale()` は以下の将来拡張に備えたAPIとして追加する:

- スナップショットが存在しない場合のフォールバックとして、CacheManager の stale データを参照する拡張
- Service Worker 側で stale データを即時返却し、バックグラウンドで revalidate する拡張

初期実装ではスナップショット機構のみで即時表示を実現する。レビューで `getStale()` が不要と判断された場合は削除してよい。
