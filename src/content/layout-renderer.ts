import { Settings } from '../types/settings';
import { Issue, Project } from '../types/api';
import {
  createContainer,
  createSection,
  createLoadingElement,
  removeElements,
  hideElements,
  appendContent,
  showElements,
  createElement,
  createSpinnerIcon,
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

const DASHBOARD_SELECTORS = [
  '.js-feed-personal-container',
  'aside[aria-label="Explore"]',
  '.dashboard-sidebar',
];

interface HeaderElements {
  header: HTMLElement;
  loadingIndicator: HTMLElement;
  loadingText: HTMLElement;
}

let headerLoadingIndicatorRef: HTMLElement | null = null;
let headerLoadingTextRef: HTMLElement | null = null;

/**
 * レイアウトレンダラー
 * GitHubダッシュボードのカスタムレイアウトを構築する
 */

/**
 * カスタムスタイルを注入（初回のみ）
 */
function ensureGlobalStyles(): void {
  if (document.getElementById('github-dashboard-customizer-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'github-dashboard-customizer-styles';
  style.textContent = `
    @keyframes gdc-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .gdc-spinner-icon {
      display: inline-block;
      border: 2px solid #d0d7de;
      border-top-color: #0969da;
      border-radius: 50%;
      animation: gdc-spin 0.8s linear infinite;
      box-sizing: border-box;
    }

    .gdc-header {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 24px;
    }

    .gdc-header-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .gdc-title-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .gdc-title {
      font-size: 22px;
      font-weight: 600;
      color: #24292f;
      margin: 0;
    }

    .gdc-subtitle {
      font-size: 13px;
      color: #57606a;
      margin: 0;
    }

    .gdc-header-controls {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .gdc-loading-indicator {
      display: none;
      align-items: center;
      gap: 8px;
      color: #57606a;
      font-size: 13px;
    }

    .gdc-loading-indicator.is-active {
      display: inline-flex;
    }

    .gdc-embedded-sidebar {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
  `;

  document.head.appendChild(style);
}

/**
 * 既存のGitHubダッシュボード要素を非表示
 */
export function clearDashboard(): void {
  console.log('Clearing existing dashboard elements...');

  DASHBOARD_SELECTORS.forEach((selector) => {
    hideElements(selector);
  });
}

/**
 * 既存のGitHubダッシュボード要素を再表示
 */
export function restoreDashboard(): void {
  console.log('Restoring GitHub dashboard elements...');
  DASHBOARD_SELECTORS.forEach((selector) => {
    showElements(selector);
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
 * @param options レイアウトオプション
 * @returns 作成されたコンテナ要素
 */
export function applyLayout(
  settings: Settings,
  _options: { isCustomMode?: boolean } = {}
): HTMLDivElement {
  console.log('Applying custom layout...', settings);

  ensureGlobalStyles();

  // 既存のダッシュボードをクリア
  clearDashboard();

  // ルートコンテナを作成
  const rootContainer = createRootContainer();

  // ヘッダーを作成
  const { header, loadingIndicator, loadingText } = createHeader();
  headerLoadingIndicatorRef = loadingIndicator;
  headerLoadingTextRef = loadingText;

  rootContainer.appendChild(header);

  // 設定に基づいてセクションを作成
  const sections = createSections(settings);

  sections.forEach((section) => {
    rootContainer.appendChild(section);
  });

  moveSectionToSidebar('section-issues', rootContainer);

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

function moveSectionToSidebar(
  sectionId: string,
  rootContainer: HTMLElement
): void {
  const section = rootContainer.querySelector(`#${sectionId}`);
  if (!section) {
    return;
  }

  const targetSidebar = document.querySelector(
    '.feed-left-sidebar'
  ) as HTMLElement | null;

  if (!targetSidebar) {
    // サイドバーが見つからない場合は元の位置に残す
    return;
  }

  const existing = targetSidebar.querySelector(`#${sectionId}`);
  if (existing) {
    existing.remove();
  }

  const container = ensureEmbeddedSidebarContainer(targetSidebar);
  container.appendChild(section);
}

function ensureEmbeddedSidebarContainer(targetSidebar: HTMLElement): HTMLElement {
  let container = targetSidebar.querySelector(
    '.gdc-embedded-sidebar'
  ) as HTMLElement | null;

  if (!container) {
    container = createElement('div', {
      className: 'gdc-embedded-sidebar',
      styles: {
        marginBottom: '16px',
      },
    });

    targetSidebar.insertBefore(container, targetSidebar.firstChild);
  }

  return container;
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
 * @param options レイアウトオプション
 */
export function rebuildLayout(
  settings: Settings,
  options: { isCustomMode?: boolean } = {}
): HTMLDivElement {
  console.log('Rebuilding layout...');

  // 既存のカスタムレイアウトを削除
  removeElements('#github-dashboard-customizer-root');

  // 新しいレイアウトを適用
  return applyLayout(settings, options);
}

/**
 * ヘッダーを作成
 */
function createHeader(): HeaderElements {
  const header = createElement('header', {
    className: 'gdc-header',
  });

  const mainRow = createElement('div', {
    className: 'gdc-header-main',
  });

  const titleBlock = createElement('div', {
    className: 'gdc-title-block',
  });

  const title = createElement('h1', {
    className: 'gdc-title',
    textContent: 'GitHub Dashboard Customizer',
  });

  const subtitle = createElement('p', {
    className: 'gdc-subtitle',
    textContent: 'GitHubダッシュボードの表示を簡単に切り替えできます。',
  });

  titleBlock.appendChild(title);
  titleBlock.appendChild(subtitle);

  const controls = createElement('div', {
    className: 'gdc-header-controls',
  });

  const loadingIndicator = createElement('div', {
    className: 'gdc-loading-indicator',
    attributes: {
      role: 'status',
      'aria-live': 'polite',
    },
  });
  const loadingSpinner = createSpinnerIcon(16);
  const loadingText = createElement('span', {
    className: 'gdc-loading-text',
    textContent: 'GitHubからデータ取得中…',
  });
  loadingIndicator.appendChild(loadingSpinner);
  loadingIndicator.appendChild(loadingText);

  controls.appendChild(loadingIndicator);

  mainRow.appendChild(titleBlock);
  mainRow.appendChild(controls);
  header.appendChild(mainRow);

  return {
    header,
    loadingIndicator,
    loadingText,
  };
}

/**
 * セクションにデータを描画
 * @param sectionId セクションID
 * @param data データ
 */
export async function renderSectionData(
  sectionId: string,
  data: {
    repositories?: GroupedRepositories[];
    issues?: Issue[];
    projects?: Project[];
  }
): Promise<void> {
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
          await renderRepositoryList(
            content as HTMLElement,
            data.repositories
          );
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
 * ヘッダーのローディング状態を更新
 * @param isLoading ローディング中かどうか
 * @param message 任意のメッセージ
 */
export function setHeaderLoadingState(
  isLoading: boolean,
  message?: string
): void {
  if (!headerLoadingIndicatorRef || !headerLoadingTextRef) {
    return;
  }

  if (message) {
    headerLoadingTextRef.textContent = message;
  }

  if (isLoading) {
    headerLoadingIndicatorRef.classList.add('is-active');
  } else {
    headerLoadingIndicatorRef.classList.remove('is-active');
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

