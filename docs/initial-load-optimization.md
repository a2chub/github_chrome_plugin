# Initial Load Optimization 仕様書

## 目的
- 初回アクセス（あるいはTabを切り替えた直後）に以前取得したデータが表示されるまでの時間を短縮する
- 取得済みデータがある場合はそちらをまず最速で表示し、APIレスポンスが戻ってきたタイミングで必要に応じて再描画する
- できる限り長い期間、最後に取得したデータを破棄せず保持し、ユーザーに「空の画面」を見せない

## 現状の問題と狙い
1. `content-script` が `fetchAndRenderData` まで待っているため、APIコール完了までセクションが空のまま
2. `cache-manager` の TTL は 5 分で、レンダリング可能なデータの保存には使われていない
3. `chrome.storage.local` 上にレンダリング用のスナップショットが存在すればそれを表示し、新しいデータが到着したら差し替える流れを追加する

## 改修の流れ（コンテンツスクリプト）
1. `applyCustomizations` 内で `fetchAndRenderData` を呼ぶ直前に `loadCachedDashboardData` を実行し、`lastDashboardSnapshot`（後述）から即時描画
2. 旧データを表示したタイミングでも `setHeaderLoadingState(true, '最新データを読み込み中…')` を維持し、APIコール中であることを明示
3. APIコールが成功すれば `renderData` によって差し替え＆ `lastDashboardSnapshot` を更新。失敗しても既存の表示を維持しつつエラー表示
4. `fetchAndRenderData` を `renderCachedDataThenFetch` のような構造にし、可能な限りデータを2段階で描画する

## キャッシュの構造とストレージ
- キー：`lastDashboardSnapshot`
- 型：
  ```ts
  interface CachedSection<T> {
    data: T;
    updatedAt: number; // ミリ秒タイムスタンプ
  }

  interface CachedDashboardSnapshot {
    repositories?: CachedSection<GroupedRepository[]>;
    issues?: CachedSection<Issue[]>;
    projects?: CachedSection<Project[]>;
  }
  ```
- `storage.ts` に以下のヘルパーを追加
  - `saveDashboardSnapshot(snapshot: CachedDashboardSnapshot): Promise<void>`
  - `getDashboardSnapshot(): Promise<CachedDashboardSnapshot | null>`
  - `removeDashboardSnapshot(): Promise<void>`（`handleRefreshData` から呼べるようにして明示的にクリア）
- データは TTL に縛られず、`remove` されない限り残る（`cache-manager` とは独立）
- データサイズを抑えるため、`GroupedRepository[]` については `repository` の重要項目のみを保持（既存の構造をそのまま使う場合は `Partial` を検討）

## サービスワーカーの側
1. `handleGetData` で取得した `result` を `saveDashboardSnapshot` 経由で保存してからレスポンス
2. APIエラー時は、キャッシュ更新をせず、差し替えを行わないことで既存表示を保持
3. `handleRefreshData` では `cache.clearAll()` に加えて `removeDashboardSnapshot()` を呼ぶ

## 表示の更新戦略
- 初回ロード時：`renderCachedDashboardData` が存在すれば `renderData` を呼び出して即描画（`setHeaderLoadingState` は true のまま）
- API 通信完了時：`renderData` を再度呼び出し、UIに差分があっても `renderSectionData` 内で上書き
- 同じデータの再描画を避ける必要がある場合は `renderData` に渡すオブジェクトにタイムスタンプを持たせ、`renderSectionData` 側で比較（必要に応じて）
- ロード中に API が失敗すると、キャッシュだけの表示を残しつつ `renderSectionError` を適用（必要なら「古いキャッシュを表示」と明記）

## テスト戦略
1. `storage` の新ヘルパーに対するユニットテスト（`chrome.storage.local` をモック）
2. `content-script` の `renderCachedDashboardData` 呼び出しと表示更新の流れを `jest` シミュレーション
3. `service-worker` の `handleGetData` で保存処理が呼ばれることと、`handleRefreshData` によってスナップショットがクリアされることを確認

## 想定するファイル変更箇所
- `src/content/content-script.ts`
- `src/content/layout-renderer.ts`（必要であれば即時描画用ヘルパー追加）
- `src/background/service-worker.ts`
- `src/utils/storage.ts`
- `src/types/settings.ts`（`CachedDashboardSnapshot` 型を追加するか、別ファイル）
- `docs/verification.md` などのテスト記載ファイル

## 付録：用語
- スナップショット：直近の API 結果をそのまま保存した JSON
- キャッシュ vs スナップショット：`cache-manager` は TTL 制御を行う一方で、今回のスナップショットは永久保存（手動クリア必要）

