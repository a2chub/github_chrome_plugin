# 設計書

## 1. アーキテクチャ設計

### 1.1 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │ Options Page │      │ Content      │                     │
│  │ (設定画面)    │◄────►│ Script       │                     │
│  │              │      │ (DOM操作)    │                     │
│  └──────┬───────┘      └──────┬───────┘                     │
│         │                     │                               │
│         │                     │                               │
│         ▼                     ▼                               │
│  ┌───────────────────────────────────────┐                   │
│  │     Background Script                 │                   │
│  │     (Service Worker)                  │                   │
│  │  - GitHub API呼び出し                 │                   │
│  │  - 認証管理                           │                   │
│  │  - キャッシュ管理                     │                   │
│  └───────────────────────────────────────┘                   │
│         │                                                     │
│         ▼                                                     │
│  ┌──────────────┐                                            │
│  │ GitHub API   │                                            │
│  └──────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 コンポーネント構成

#### 1.2.1 Options Page（設定画面）
- **役割**: ユーザーがレイアウトや表示設定をカスタマイズするUI
- **技術**: HTML, CSS, JavaScript (TypeScript)
- **機能**:
  - 要素の表示/非表示設定
  - 並び順の設定（ドラッグ&ドロップ）
  - PAT入力・管理
  - Export/Import機能

#### 1.2.2 Content Script
- **役割**: GitHubダッシュボードページのDOM操作
- **技術**: TypeScript
- **機能**:
  - 既存要素の削除・非表示
  - カスタムレイアウトの適用
  - データの表示（Background Scriptから受け取る）

#### 1.2.3 Background Script（Service Worker）
- **役割**: GitHub APIとの通信、認証管理、データキャッシュ
- **技術**: TypeScript
- **機能**:
  - GitHub API呼び出し
  - PATの管理
  - APIレスポンスのキャッシュ
  - レートリミット管理
  - Content Scriptへのメッセージ送信

#### 1.2.4 Storage
- **役割**: 設定データとPATの保存
- **技術**: Chrome Storage API
- **保存データ**:
  - レイアウト設定（JSON形式）
  - PAT（暗号化推奨）
  - キャッシュデータ

## 2. 技術スタック

### 2.1 コア技術
- **Manifest**: V3
- **言語**: TypeScript
- **ビルドツール**: 未定（webpack/vite/esbuild等を検討）
- **パッケージマネージャー**: npm または yarn

### 2.2 ライブラリ・フレームワーク
- **UI**: バニラJavaScript/TypeScript（軽量性重視）
- **API通信**: Fetch API
- **DOM操作**: バニラJavaScript/TypeScript
- **設定管理**: Chrome Storage API

### 2.3 開発ツール
- **型チェック**: TypeScript
- **リント**: ESLint
- **フォーマット**: Prettier
- **テスト**: Jest または Vitest（検討）

## 3. データフロー

### 3.1 初期読み込みフロー

```
1. ユーザーがGitHubダッシュボードにアクセス
   ↓
2. Content Scriptが注入される
   ↓
3. Content ScriptがBackground Scriptに設定を要求
   ↓
4. Background ScriptがStorageから設定を取得
   ↓
5. Background Scriptが設定をContent Scriptに送信
   ↓
6. Content ScriptがDOMを操作してレイアウトを適用
   ↓
7. Content ScriptがBackground Scriptにデータ取得を要求
   ↓
8. Background ScriptがGitHub APIを呼び出し
   ↓
9. Background Scriptがレスポンスをキャッシュ
   ↓
10. Background ScriptがデータをContent Scriptに送信
    ↓
11. Content Scriptがデータを表示
```

### 3.2 設定変更フロー

```
1. ユーザーがOptions Pageで設定を変更
   ↓
2. Options PageがStorageに設定を保存
   ↓
3. Options PageがBackground Scriptに設定変更を通知
   ↓
4. Background ScriptがContent Scriptに設定変更を通知
   ↓
5. Content ScriptがDOMを再構築
```

### 3.3 データ更新フロー

```
1. Content Scriptが定期的にデータ更新を要求
   ↓
2. Background Scriptがキャッシュを確認
   ↓
3. キャッシュが有効な場合 → キャッシュを返す
   キャッシュが無効な場合 → GitHub APIを呼び出し
   ↓
4. Background Scriptがレスポンスをキャッシュ
   ↓
5. Background ScriptがデータをContent Scriptに送信
   ↓
6. Content ScriptがUIを更新
```

## 4. セキュリティ設計

### 4.1 PAT管理

#### 4.1.1 保存方法
- Chrome Storage APIの`chrome.storage.local`を使用
- 可能であれば暗号化（Chromeのネイティブ機能またはライブラリ）

#### 4.1.2 アクセス制御
- PATはBackground Scriptでのみ使用
- Content ScriptにはPATを渡さない
- Options Pageでは表示時のみマスク表示

#### 4.1.3 トークン検証
- 初回入力時にAPI呼び出しでトークンの有効性を確認
- 定期的にトークンの有効性をチェック

### 4.2 設定データの保護
- 設定データはJSON形式で保存
- Export/Import時はJSON形式で扱う
- 悪意のあるJSONの検証

### 4.3 通信のセキュリティ
- HTTPS経由でのみGitHub APIと通信
- CORSポリシーの遵守
- メッセージパッシングの検証

## 5. UI/UX設計

### 5.1 Options Page（設定画面）

#### 5.1.1 レイアウト
```
┌─────────────────────────────────────────┐
│  GitHub Dashboard Customizer Settings   │
├─────────────────────────────────────────┤
│                                         │
│  [認証設定]                              │
│  Personal Access Token: [___________]   │
│  [保存]                                  │
│                                         │
│  [レイアウト設定]                        │
│  ┌─────────────────────────────────┐   │
│  │ ☑ Organization別リポジトリリスト │   │
│  │ ☑ メンションされたIssueリスト    │   │
│  │ ☑ 更新順プロジェクトサマリー     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [並び順]                                │
│  [ドラッグ&ドロップで並び替え]          │
│                                         │
│  [Export/Import]                        │
│  [設定をエクスポート] [設定をインポート] │
│                                         │
└─────────────────────────────────────────┘
```

#### 5.1.2 機能詳細
- **認証設定セクション**: PATの入力・保存・削除
- **レイアウト設定セクション**: 各要素の表示/非表示チェックボックス
- **並び順セクション**: ドラッグ&ドロップで並び替え可能なリスト
- **Export/Importセクション**: JSONファイルのダウンロード/アップロード

### 5.2 Content Script（ダッシュボード表示）

#### 5.2.1 レイアウト構造
```
┌─────────────────────────────────────────┐
│  GitHub Dashboard (Customized)          │
├─────────────────────────────────────────┤
│                                         │
│  [Organization別リポジトリリスト]        │
│  ┌─────────────────────────────────┐   │
│  │ Organization A                 │   │
│  │   - repo1 (updated 2h ago)     │   │
│  │   - repo2 (updated 5h ago)     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [メンションされたIssueリスト]          │
│  ┌─────────────────────────────────┐   │
│  │ #123 Fix bug in feature (Open)  │   │
│  │ #456 Review PR (Open)            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [更新順プロジェクトサマリー]            │
│  ┌─────────────────────────────────┐   │
│  │ Project A - Updated 1h ago       │   │
│  │ Project B - Updated 3h ago       │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

#### 5.2.2 スタイリング
- GitHubの既存スタイルに合わせる
- カスタムCSSで微調整
- レスポンシブデザインを考慮

## 6. API設計

### 6.1 GitHub API使用エンドポイント

#### 6.1.1 認証
- **方法**: Personal Access Token（PAT）
- **ヘッダー**: `Authorization: token <PAT>`

#### 6.1.2 使用するAPIエンドポイント

**ユーザー情報**
- `GET /user` - 認証済みユーザー情報

**Organization**
- `GET /user/orgs` - ユーザーが所属するOrganization一覧

**リポジトリ**
- `GET /user/repos` - ユーザーのリポジトリ一覧（全Organization含む）
- `GET /orgs/{org}/repos` - 特定Organizationのリポジトリ一覧
- `GET /repos/{owner}/{repo}` - リポジトリ詳細

**Issue**
- `GET /issues` - 認証済みユーザーに関連するIssue一覧（メンション含む）
- `GET /repos/{owner}/{repo}/issues` - 特定リポジトリのIssue一覧

**プロジェクト**
- `GET /user/projects` - ユーザーのプロジェクト一覧
- `GET /orgs/{org}/projects` - Organizationのプロジェクト一覧
- `GET /projects/{project_id}` - プロジェクト詳細

### 6.2 内部API（Chrome Extension内）

#### 6.2.1 メッセージパッシング

**Content Script → Background Script**
```typescript
// 設定取得要求
chrome.runtime.sendMessage({
  type: 'GET_SETTINGS'
});

// データ取得要求
chrome.runtime.sendMessage({
  type: 'GET_DATA',
  dataType: 'repositories' | 'issues' | 'projects'
});
```

**Background Script → Content Script**
```typescript
// 設定送信
chrome.tabs.sendMessage(tabId, {
  type: 'SETTINGS',
  settings: {...}
});

// データ送信
chrome.tabs.sendMessage(tabId, {
  type: 'DATA',
  dataType: 'repositories' | 'issues' | 'projects',
  data: [...]
});
```

**Options Page ↔ Background Script**
```typescript
// 設定保存
chrome.runtime.sendMessage({
  type: 'SAVE_SETTINGS',
  settings: {...}
});

// PAT保存
chrome.runtime.sendMessage({
  type: 'SAVE_TOKEN',
  token: '...'
});
```

### 6.3 データ構造

#### 6.3.1 設定データ構造
```typescript
interface Settings {
  layout: {
    enabled: boolean;
    order: number;
  }[];
  token: string; // PAT
  cache: {
    repositories: CacheEntry;
    issues: CacheEntry;
    projects: CacheEntry;
  };
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live (秒)
}
```

#### 6.3.2 APIレスポンスデータ構造
```typescript
interface Repository {
  id: number;
  name: string;
  full_name: string;
  organization: string;
  updated_at: string;
  html_url: string;
}

interface Issue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  repository: string;
  html_url: string;
  updated_at: string;
}

interface Project {
  id: number;
  name: string;
  organization: string;
  updated_at: string;
  html_url: string;
}
```

## 7. エラーハンドリング

### 7.1 APIエラー
- **401 Unauthorized**: PATが無効 → ユーザーに再入力要求
- **403 Forbidden**: 権限不足 → エラーメッセージ表示
- **404 Not Found**: リソース不存在 → スキップ
- **429 Too Many Requests**: レートリミット → リトライ待機
- **500 Server Error**: サーバーエラー → リトライ

### 7.2 ネットワークエラー
- タイムアウト: 30秒でタイムアウト
- 接続エラー: リトライ（指数バックオフ）

### 7.3 データエラー
- JSONパースエラー: エラーログ出力、デフォルト値使用
- データ不整合: バリデーション、エラーメッセージ表示

## 8. パフォーマンス最適化

### 8.1 キャッシュ戦略
- APIレスポンスを5分間キャッシュ
- キャッシュヒット時はAPI呼び出しをスキップ
- キャッシュ無効化は手動または時間ベース

### 8.2 レートリミット管理
- API呼び出し頻度の監視
- レートリミット接近時の警告
- バッチリクエストの検討

### 8.3 DOM操作の最適化
- 一括DOM操作（DocumentFragment使用）
- 必要最小限の再描画
- 遅延読み込みの実装

## 9. ファイル構造

```
github-chrome-extension/
├── manifest.json
├── package.json
├── tsconfig.json
├── src/
│   ├── background/
│   │   ├── service-worker.ts
│   │   ├── api-client.ts
│   │   └── cache-manager.ts
│   ├── content/
│   │   ├── content-script.ts
│   │   ├── dom-manipulator.ts
│   │   └── layout-renderer.ts
│   ├── options/
│   │   ├── options.html
│   │   ├── options.ts
│   │   └── options.css
│   ├── types/
│   │   ├── settings.ts
│   │   ├── api.ts
│   │   └── messages.ts
│   └── utils/
│       ├── storage.ts
│       └── validation.ts
├── docs/
│   ├── requirements.md
│   ├── design.md
│   └── implementation-plan.md
└── README.md
```

## 10. テスト戦略

### 10.1 単体テスト
- APIクライアントのテスト
- データ変換ロジックのテスト
- 設定管理のテスト

### 10.2 統合テスト
- Content ScriptとBackground Scriptの連携テスト
- Options PageとStorageの連携テスト

### 10.3 E2Eテスト
- 実際のGitHubページでの動作確認
- 設定変更の反映確認

## 11. デプロイメント

### 11.1 開発環境
- Chrome拡張機能の開発者モードで読み込み
- ホットリロードの実装（可能であれば）

### 11.2 本番環境
- Chrome Web Storeへの公開
- バージョン管理
- 更新通知機能

