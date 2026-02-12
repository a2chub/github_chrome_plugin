# 設計レビュー結果

## 総合判定: APPROVE WITH CONDITIONS

設計の方向性は正しく、Stale-while-revalidateパターンの採用は適切。ただし、以下の問題を修正しないと実装に進むべきではない。

---

## Critical（修正必須）

### C-1: `getStale()` メソッドは YAGNI 違反 — 追加してはならない

設計書セクション8で「本設計では `getStale()` は直接使用しない」と明言しているにもかかわらず、セクション2.1でメソッド追加を提案している。これは明確なYAGNI（You Ain't Gonna Need It）違反。

- 使われないコードは負債である。テスト不要、レビュー不要、メンテナンス不要のコードを最初から入れる理由がない
- 「将来の拡張に備えて」は過剰設計の典型的な言い訳。必要になった時に追加すれば十分
- `cache-manager.ts` の変更が不要になれば、**変更対象ファイルが2つに減る**（content-script.ts と message-handlers.ts のみ）

**修正**: `getStale()` メソッドの追加を設計から削除する。セクション2.1、セクション6の変更対象ファイルまとめ、セクション7の実装順序、セクション8を丸ごと削除。

---

## Major（修正推奨）

### M-1: fire-and-forget化によるレースコンディション — 設定変更時にデータ再取得がスキップされる

`fetchAndRenderData()` のawaitを外すことで、以下のシナリオが発生する:

```
1. applyCustomizations() → fetchAndRenderData() [fire-and-forget, isFetchingData=true]
2. 数百ms後: SETTINGS_UPDATED メッセージ受信
3. handleSettingsUpdated() → rebuildLayout() → fetchAndRenderData()
4. fetchAndRenderData() の冒頭ガード: isFetchingData===true → return（スキップ！）
5. 最初のfetchが完了 → 古い設定に基づくデータで描画
```

**結果**: 設定変更が反映されない。ユーザーはリポジトリ表示設定を変更しても、ページリロードするまで反映されない可能性がある。

現在のコードでは `await fetchAndRenderData()` のため、設定更新メッセージが届く時点で初回fetchは完了済み。await除去はこの前提を壊す。

**修正提案**: `isFetchingData` ガードに加えて、fetchが進行中に設定が更新された場合の再fetch機構を追加する。例:

```typescript
let pendingRefetch = false;

async function fetchAndRenderData() {
  if (isFetchingData) {
    pendingRefetch = true;  // 完了後に再fetchを要求
    return;
  }
  // ...existing logic...
  finally {
    isFetchingData = false;
    setHeaderLoadingState(false);
    if (pendingRefetch) {
      pendingRefetch = false;
      fetchAndRenderData();  // 再fetch
    }
  }
}
```

または、よりシンプルに: `handleSettingsUpdated()` で `isFetchingData = false` をリセットしてから `fetchAndRenderData()` を呼ぶ（進行中のfetchの結果は `isCustomLayoutActive` ガードで破棄される）。

### M-2: staleデータがAPIエラーで上書き消去される — UXが悪化する

設計書セクション4.3で認識しているが、「初期実装では許容する」という判断は不適切。

Stale-while-revalidateの根本的な価値は「古くてもデータを見せ続ける」こと。APIエラー時にstaleデータをエラーメッセージで置き換えるのは、このパターンの本質を否定している。

**シナリオ**:
1. キャッシュからリポジトリ一覧を即座に表示（体感0ms）
2. バックグラウンドでAPI取得 → GitHub APIが一時的に503を返す
3. `showDataError()` が全セクションをエラーメッセージで上書き
4. ユーザー: 「さっきまで見えてたデータが消えた」

**修正提案**: staleデータが表示済みかどうかを追跡するフラグを追加し、stale表示中のAPIエラーはヘッダーのみに表示、セクションデータは保持する。

```typescript
let hasCachedDataRendered = false;

async function renderCachedDashboardData(): Promise<void> {
  // ... existing ...
  await renderData(cachedData);
  hasCachedDataRendered = true;
}

// fetchAndRenderData の error handling:
if (!response.success) {
  if (hasCachedDataRendered) {
    // staleデータ表示中 → ヘッダーにのみ控えめにエラー表示
    setHeaderLoadingState(true, 'データの更新に失敗しました');
  } else {
    showDataError(response.error || 'データの取得に失敗しました');
  }
}
```

### M-3: ローディングインジケータがトークン未設定時に消えない

以下のシナリオでローディングインジケータが永遠にアクティブのままになる:

```
1. 2回目以降のアクセス（スナップショットあり）
2. renderCachedDashboardData() → setHeaderLoadingState(true, 'キャッシュされたデータを表示しています…')
3. トークンチェック → 未設定 → showTokenRequiredBanner() → return
4. fetchAndRenderData() は呼ばれない → setHeaderLoadingState(false) も呼ばれない
5. ローディングインジケータが回り続ける
```

これは既存コードにも存在するバグだが、設計書の変更範囲に `renderCachedDashboardData()` のフローが含まれている以上、ここで修正すべき。

**修正提案**: `renderCachedDashboardData()` の最後で `setHeaderLoadingState(false)` を呼ぶか、`applyCustomizations()` のトークンチェック前に `setHeaderLoadingState(false)` を呼ぶ。

### M-4: Promise.all の全滅挙動に対する考慮不足

`handleGetData()` を `Promise.all` に変更した場合:

```typescript
const [repositories, issues, projects] = await Promise.all([
  fetchRepositories(client, cache),   // ← これが失敗すると
  fetchMentionedIssues(client, cache), // ← これの結果も捨てられる
  fetchProjects(client, cache),
]);
```

`fetchProjects` は内部でcatchして `[]` を返すが、`fetchRepositories` と `fetchMentionedIssues` はエラーをthrowする。1つのAPI失敗で全データが失われる。

現在の逐次実行でも同じ挙動（catchブロックで全体をthrow）なので**動作は同等**だが、並列化を行う良い機会なので `Promise.allSettled` の採用を検討すべき。部分的なデータ返却が可能になり、resilience（回復力）が向上する。

**修正提案**: 「並列化時は `Promise.allSettled` を使い、成功した分だけ返す」というアプローチを検討すること。初期実装では `Promise.all` でも許容するが、設計書にトレードオフの記述を追加する。

---

## Minor（任意）

### m-1: トークン変更時にスナップショットが無効化されない

ユーザーAのトークンで取得したスナップショットが保存された状態で、ユーザーBのトークンに変更した場合:

1. ページロード → ユーザーAのスナップショットが表示される
2. ユーザーBのデータがfetchされて上書き

表示時間は数秒程度だが、別アカウントのデータが一瞬見えるのは混乱を招く。

`handleSaveToken()` (message-handlers.ts:86-93) で `removeDashboardSnapshot()` を呼ぶべき。

### m-2: スナップショットの鮮度チェックがない

スナップショットにはTTLの概念がなく、設計書セクション4.6でも「初期実装では許容する」としている。しかし、1週間前のデータが0msで表示されてから最新データに切り替わるのは、ユーザーの混乱を招く可能性がある。

`getDashboardSnapshot()` で `updatedAt` を確認し、例えば24時間以上古い場合はnullを返す簡単なガードを追加することを推奨。

### m-3: DOM再描画によるチラつきの可能性

キャッシュデータ → APIデータ の切り替え時、`renderData()` はセクション内のDOM全体を置き換える（`renderSectionData` → 各コンポーネントのrender関数）。データが同じ場合でも完全なDOM再構築が行われる。

大量のリポジトリがある場合、視覚的なチラつきが発生する可能性がある。初期実装では許容可能だが、将来的にはデータの差分チェック（shallow compare）を検討すべき。

### m-4: ストレージ容量への影響の見積もりがない

`CachedDashboardSnapshot` は repositories（最大1000件）、issues（最大50件）、projects のフルデータを保存する。1リポジトリあたりのJSONサイズを仮に1KB とすると、リポジトリだけで最大1MB。`chrome.storage.local` の上限は10MB（`unlimitedStorage` 権限なし）。

設計書にストレージ使用量の概算を追加し、必要に応じて `unlimitedStorage` 権限の追加を検討すべき。

---

## Good Points

- **Stale-while-revalidateパターンの選択は適切**: 初期表示の高速化に対する正統的なアプローチ
- **既存のスナップショット機構の活用**: `saveDashboardSnapshot()` / `getDashboardSnapshot()` が既に実装されているのに使われていなかった問題を的確に指摘
- **新メッセージタイプを追加しないという判断は正しい**: content-scriptから `chrome.storage.local` に直接アクセスできるため、Service Worker経由の通信は不要
- **github-api.ts を変更しないという判断は正しい**: TTL準拠のキャッシュ層はそのまま維持し、staleデータの提供はスナップショット機構で分離する設計は責務の分離として適切
- **フロー図とUXパターンの記述が明確**: パターンA/Bの区別は理解しやすい
- **`handleValidateToken()` で既に `Promise.all` が使われている点の指摘**は、コードベースの一貫性を意識した良い観察

---

## 修正提案まとめ

| # | 重要度 | 修正内容 | 影響ファイル |
|---|--------|---------|-------------|
| C-1 | Critical | `getStale()` メソッドを削除 | cache-manager.ts（変更不要に） |
| M-1 | Major | 設定変更時のfetch競合への対処 | content-script.ts |
| M-2 | Major | staleデータ表示中のエラーハンドリング改善 | content-script.ts |
| M-3 | Major | ローディングインジケータのリーク修正 | content-script.ts |
| M-4 | Major | Promise.all vs allSettled のトレードオフ記述 | message-handlers.ts |
| m-1 | Minor | トークン変更時のスナップショット無効化 | message-handlers.ts |
| m-2 | Minor | スナップショット鮮度チェック追加 | content-script.ts |
| m-3 | Minor | DOM再描画のチラつき対策の検討 | (将来課題) |
| m-4 | Minor | ストレージ容量の見積もり追加 | 設計書のみ |

**最低限 C-1 と M-1, M-2, M-3 の4点を設計に反映した上で、実装に進むことを推奨する。**
