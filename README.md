# GitHub Dashboard Customizer

GitHub.comのログイン後ダッシュボードページのレイアウトを、ユーザーの好みに合わせて完全にカスタマイズできるChrome拡張機能です。

## 機能概要

- **完全カスタマイズ可能なレイアウト**: GitHubダッシュボードの既存要素を削除し、ユーザーが指定したレイアウトで完全に書き換えます
- **設定画面によるカスタマイズ**: オプションページで要素の表示/非表示、並び順を設定できます
- **Organization別リポジトリリスト**: Organization単位で、最近使用したリポジトリを表示します
- **メンションされたIssueリスト**: ユーザーがメンションされているIssueを一覧表示します
- **更新順プロジェクトサマリー**: 更新順にプロジェクトのサマリーを表示します
- **設定のExport/Import**: 設定をJSON形式でエクスポート/インポートでき、別マシンへの設定移植が容易です

## プロジェクト構成

```
github_chrome_plugin/
├── src/                    # ソースコード
│   ├── background/         # Background Script (Service Worker)
│   │   └── service-worker.ts
│   ├── content/            # Content Script
│   │   ├── content-script.ts
│   │   ├── dom-manipulator.ts
│   │   └── layout-renderer.ts
│   ├── options/            # Options Page (設定画面)
│   │   ├── options.html
│   │   ├── options.ts
│   │   └── options.css
│   ├── types/              # TypeScript型定義
│   │   ├── settings.ts
│   │   ├── api.ts
│   │   └── messages.ts
│   └── utils/              # ユーティリティ関数
│       ├── storage.ts
│       └── validation.ts
├── assets/                 # 静的リソース
│   └── icons/              # 拡張機能アイコン
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── dist/                   # ビルド成果物（.gitignore対象）
├── docs/                   # ドキュメント
│   ├── requirements.md    # 要件定義書
│   ├── design.md          # 設計書
│   ├── implementation-plan.md  # 実装計画
│   ├── verification.md    # 検証手順書
│   └── issues/            # ローカルIssueファイル
│       ├── phase-1-base.md
│       ├── phase-2-settings-dom.md
│       ├── phase-3-api-integration.md
│       ├── phase-4-core-features.md
│       ├── phase-5-export-import.md
│       └── phase-6-error-handling-optimization.md
├── tests/                  # テスト
│   ├── unit/              # 単体テスト
│   └── e2e/               # E2Eテスト
├── .gitignore
├── package.json
└── README.md
```

## セットアップ

### 前提条件

- Node.js (v18以上推奨)
- npm または yarn
- Chromeブラウザ（最新版）

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/a2chub/github_chrome_plugin.git
cd github_chrome_plugin

# 依存関係をインストール
npm install
# または
yarn install
```

### ビルド

```bash
npm run build
# または
yarn build
```

## 開発

### Chrome拡張機能の読み込み

1. Chromeブラウザを開く
2. `chrome://extensions/` にアクセス
3. 「デベロッパーモード」をONにする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. プロジェクトのルートディレクトリ（または `dist/` ディレクトリ）を選択

詳細な検証手順は [検証手順書](docs/verification.md) を参照してください。

### 開発モード

```bash
npm run dev
# または
yarn dev
```

### テスト

```bash
npm test
# または
yarn test
```

## 使用方法

### 初回セットアップ

1. 拡張機能をインストール
2. GitHubにログイン
3. GitHubのPersonal Access Token（PAT）を取得
   - Settings → Developer settings → Personal access tokens → Tokens (classic)
   - 必要なスコープ: `repo`, `read:org`, `read:project`
4. 拡張機能のアイコンを右クリック → 「オプション」を選択
5. PATを入力して保存
6. GitHubダッシュボードページ（`https://github.com`）を開く
7. カスタマイズされたレイアウトが表示される

### 設定のカスタマイズ

1. 拡張機能のアイコンを右クリック → 「オプション」を選択
2. 各要素の表示/非表示を設定
3. ドラッグ&ドロップで並び順を変更
4. 設定は自動的に保存され、即座に反映されます

### 設定のExport/Import

1. Options Pageで「設定をエクスポート」をクリック
2. JSONファイルがダウンロードされます
3. 別のマシンで「設定をインポート」をクリック
4. エクスポートしたJSONファイルを選択

## ドキュメント

- [要件定義書](docs/requirements.md)
- [設計書](docs/design.md)
- [実装計画](docs/implementation-plan.md)
- [検証手順書](docs/verification.md)

## 開発計画

本プロジェクトは6つのPhaseに分けて実装されます：

1. **Phase 1**: 基盤構築
2. **Phase 2**: 設定画面とDOM操作基盤
3. **Phase 3**: GitHub API統合（PAT認証）
4. **Phase 4**: コア機能実装
5. **Phase 5**: Export/Import機能
6. **Phase 6**: エラーハンドリングと最適化

各Phaseの詳細は [実装計画](docs/implementation-plan.md) および [GitHub Issues](https://github.com/a2chub/github_chrome_plugin/issues) を参照してください。

## 技術スタック

- **Manifest**: V3
- **言語**: TypeScript
- **ビルドツール**: 未定（webpack/vite/esbuild等を検討）
- **パッケージマネージャー**: npm または yarn

## ライセンス

未定

## 貢献

IssueやPull Requestを歓迎します。詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください（作成予定）。

## トラブルシューティング

よくある問題と解決方法は [検証手順書](docs/verification.md#トラブルシューティング) を参照してください。

