# Phase 1: 基盤構築

## 概要
Chrome拡張機能の基本構造を構築し、開発環境を整備する。

## 目的
- Chrome拡張機能がChromeに読み込める状態にする
- Content ScriptがGitHubダッシュボードページに注入される
- Background Scriptが動作する
- Options Pageが開ける

## タスク

### 1.1 プロジェクト初期化
- [ ] `package.json`の作成
  - プロジェクト名、バージョン、説明の設定
  - 依存関係の定義
- [ ] TypeScript設定（`tsconfig.json`）
  - コンパイルオプションの設定
  - モジュール解決の設定
- [ ] ビルドツールの設定（webpack/vite/esbuild）
  - ビルド設定の作成
  - 開発サーバーの設定（必要に応じて）
- [ ] ESLint/Prettierの設定
  - コード品質ルールの設定
  - フォーマットルールの設定
- [ ] `.gitignore`の確認・更新
  - ビルド成果物の除外
  - 依存関係の除外

### 1.2 Manifest V3の作成
- [ ] `manifest.json`の作成
  - 拡張機能の基本情報（name, version, description）
  - permissions設定（`storage`, `tabs`, `activeTab`等）
  - content_scripts設定（GitHubダッシュボードページへの注入）
  - background service_worker設定
  - options_page設定
  - icons設定（16x16, 48x48, 128x128）

### 1.3 基本ファイル構造の作成
- [ ] `src/background/service-worker.ts`の作成
  - 基本的なService Workerの実装
  - メッセージリスナーの設定
- [ ] `src/content/content-script.ts`の作成
  - Content Scriptの基本実装
  - DOM読み込み待機処理
- [ ] `src/options/options.html`の作成
  - 基本的なHTML構造
- [ ] `src/types/`ディレクトリの作成
- [ ] `src/utils/`ディレクトリの作成

### 1.4 型定義の作成
- [ ] `src/types/settings.ts` - 設定データの型定義
  ```typescript
  interface Settings {
    layout: LayoutItem[];
    token: string;
    cache: CacheSettings;
  }
  ```
- [ ] `src/types/api.ts` - APIレスポンスの型定義
  ```typescript
  interface Repository { ... }
  interface Issue { ... }
  interface Project { ... }
  ```
- [ ] `src/types/messages.ts` - メッセージパッシングの型定義
  ```typescript
  type MessageType = 'GET_SETTINGS' | 'SAVE_SETTINGS' | ...
  ```

### 1.5 基本機能の実装
- [ ] Chrome Storage APIのラッパー実装（`src/utils/storage.ts`）
  - 設定の保存・取得機能
  - エラーハンドリング
- [ ] メッセージパッシングの基本実装
  - Content Script ↔ Background Script
  - Options Page ↔ Background Script
- [ ] Content Scriptの基本注入確認
  - GitHubダッシュボードページでの動作確認

## 完了基準
- [x] 拡張機能がChromeに読み込める
- [x] Content ScriptがGitHubダッシュボードページに注入される
- [x] Background Scriptが動作する
- [x] Options Pageが開ける

## 見積もり時間
2-3日

## 関連ドキュメント
- [要件定義書](../requirements.md)
- [設計書](../design.md)
- [実装計画](../implementation-plan.md)

