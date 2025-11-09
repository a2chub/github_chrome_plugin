import { Settings } from '../types/settings';
import { Issue, Project } from '../types/api';
import {
  createContainer,
  createSection,
  createLoadingElement,
  removeElements,
  hideElements,
  appendContent,
} from './dom-manipulator';
import {
  renderRepositoryList,
  renderRepositoryError,
  GroupedRepositories,
} from './components/repository-list';
import {
  renderIssueList,
  renderIssueError,
} from './components/issue-list';
import {
  renderProjectSummary,
  renderProjectError,
} from './components/project-summary';

/**
 * レイアウトレンダラー
 * GitHubダッシュボードのカスタムレイアウトを構築する
 */

/**
 * 既存のGitHubダッシュボード要素を非表示/削除
 */
export function clearDashboard(): void {
  console.log('Clearing existing dashboard elements...');

  // GitHubのメインコンテンツエリアを特定
  // 注: GitHubのDOM構造が変更される可能性があるため、定期的な確認が必要
  const selectors = [
    '.js-feed-personal-container', // フィードコンテナ
    'aside[aria-label="Explore"]', // サイドバー
    '.dashboard-sidebar', // サイドバー（古いレイアウト）
  ];

  selectors.forEach((selector) => {
    hideElements(selector);
  });
}

/**
 * カスタムレイアウトのルートコンテナを作成
 * @returns ルートコンテナ要素
 */
export function createRootContainer(): HTMLDivElement {
  // 既存のカスタムコンテナを削除
  removeElements('#github-dashboard-customizer-root');

  // 新しいコンテナを作成
  const container = createContainer('github-dashboard-customizer-root');

  return container;
}

/**
 * レイアウトを適用
 * @param settings 設定データ
 * @returns 作成されたコンテナ要素
 */
export function applyLayout(settings: Settings): HTMLDivElement {
  console.log('Applying custom layout...', settings);

  // 既存のダッシュボードをクリア
  clearDashboard();

  // ルートコンテナを作成
  const rootContainer = createRootContainer();

  // 設定に基づいてセクションを作成
  const sections = createSections(settings);

  // セクションをコンテナに追加
  sections.forEach((section) => {
    rootContainer.appendChild(section);
  });

  // GitHubのメインコンテンツエリアにコンテナを挿入
  insertToPage(rootContainer);

  return rootContainer;
}

/**
 * 設定に基づいてセクションを作成
 * @param settings 設定データ
 * @returns セクション要素の配列
 */
function createSections(settings: Settings): HTMLElement[] {
  const sections: HTMLElement[] = [];

  // レイアウト設定を順序でソート
  const sortedLayout = [...settings.layout].sort((a, b) => a.order - b.order);

  sortedLayout.forEach((item) => {
    if (!item.enabled) {
      return;
    }

    const section = createSectionByType(item.id);
    if (section) {
      sections.push(section);
    }
  });

  return sections;
}

/**
 * セクションタイプに応じてセクションを作成
 * @param type セクションタイプ
 * @returns セクション要素
 */
function createSectionByType(type: string): HTMLElement | null {
  switch (type) {
    case 'repositories':
      return createRepositoriesSection();
    case 'issues':
      return createIssuesSection();
    case 'projects':
      return createProjectsSection();
    default:
      console.warn(`Unknown section type: ${type}`);
      return null;
  }
}

/**
 * リポジトリセクションを作成
 * @returns リポジトリセクション
 */
function createRepositoriesSection(): HTMLElement {
  const { section, content } = createSection(
    'Organization別リポジトリリスト',
    'section-repositories'
  );

  // Phase 4で実装
  const loading = createLoadingElement();
  appendContent(content, loading);

  return section;
}

/**
 * Issueセクションを作成
 * @returns Issueセクション
 */
function createIssuesSection(): HTMLElement {
  const { section, content } = createSection(
    'メンションされたIssueリスト',
    'section-issues'
  );

  // Phase 4で実装
  const loading = createLoadingElement();
  appendContent(content, loading);

  return section;
}

/**
 * プロジェクトセクションを作成
 * @returns プロジェクトセクション
 */
function createProjectsSection(): HTMLElement {
  const { section, content } = createSection(
    '更新順プロジェクトサマリー',
    'section-projects'
  );

  // Phase 4で実装
  const loading = createLoadingElement();
  appendContent(content, loading);

  return section;
}

/**
 * ページにコンテナを挿入
 * @param container 挿入するコンテナ
 */
function insertToPage(container: HTMLElement): void {
  // GitHubのメインコンテンツエリアを取得
  const mainContent =
    document.querySelector('main') || document.querySelector('#js-pjax-container');

  if (mainContent) {
    // メインコンテンツの最初の子として挿入
    mainContent.insertBefore(container, mainContent.firstChild);
    console.log('Custom layout inserted into page');
  } else {
    console.error('Could not find main content area');
    // フォールバック: bodyに直接追加
    document.body.insertBefore(container, document.body.firstChild);
  }
}

/**
 * レイアウトを再構築
 * @param settings 設定データ
 */
export function rebuildLayout(settings: Settings): void {
  console.log('Rebuilding layout...');

  // 既存のカスタムレイアウトを削除
  removeElements('#github-dashboard-customizer-root');

  // 新しいレイアウトを適用
  applyLayout(settings);
}

/**
 * セクションにデータを描画
 * @param sectionId セクションID
 * @param data データ
 */
export function renderSectionData(
  sectionId: string,
  data: {
    repositories?: GroupedRepositories[];
    issues?: Issue[];
    projects?: Project[];
  }
): void {
  const section = document.getElementById(sectionId);
  if (!section) {
    console.warn(`Section not found: ${sectionId}`);
    return;
  }

  const content = section.querySelector('.section-content');
  if (!content) {
    console.warn(`Section content not found: ${sectionId}`);
    return;
  }

  try {
    switch (sectionId) {
      case 'section-repositories':
        if (data.repositories) {
          renderRepositoryList(content as HTMLElement, data.repositories);
        }
        break;

      case 'section-issues':
        if (data.issues) {
          renderIssueList(content as HTMLElement, data.issues);
        }
        break;

      case 'section-projects':
        if (data.projects) {
          renderProjectSummary(content as HTMLElement, data.projects);
        }
        break;

      default:
        console.warn(`Unknown section: ${sectionId}`);
    }
  } catch (error) {
    console.error(`Error rendering section ${sectionId}:`, error);
    renderSectionError(sectionId, String(error));
  }
}

/**
 * セクションにエラーを表示
 * @param sectionId セクションID
 * @param error エラーメッセージ
 */
export function renderSectionError(sectionId: string, error: string): void {
  const section = document.getElementById(sectionId);
  if (!section) {
    return;
  }

  const content = section.querySelector('.section-content');
  if (!content) {
    return;
  }

  switch (sectionId) {
    case 'section-repositories':
      renderRepositoryError(content as HTMLElement, error);
      break;

    case 'section-issues':
      renderIssueError(content as HTMLElement, error);
      break;

    case 'section-projects':
      renderProjectError(content as HTMLElement, error);
      break;

    default:
      console.warn(`Unknown section: ${sectionId}`);
  }
}

