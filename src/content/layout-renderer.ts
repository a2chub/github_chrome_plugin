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
  toggleInput: HTMLInputElement;
  modeLabel: HTMLElement;
  loadingIndicator: HTMLElement;
  loadingText: HTMLElement;
}

let layoutToggleInputRef: HTMLInputElement | null = null;
let layoutModeLabelRef: HTMLElement | null = null;
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

    .gdc-toggle-wrapper {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .gdc-toggle {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      font-size: 13px;
      color: #57606a;
    }

    .gdc-toggle-option {
      font-weight: 500;
      color: #57606a;
    }

    .gdc-toggle-switch {
      position: relative;
      display: inline-flex;
      align-items: center;
      width: 48px;
      height: 24px;
    }

    .gdc-toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
      inset: 0;
      margin: 0;
    }

    .gdc-toggle-slider {
      position: relative;
      display: inline-block;
      width: 100%;
      height: 100%;
      background-color: #d0d7de;
      border-radius: 999px;
      transition: background-color 0.2s ease;
    }

    .gdc-toggle-slider::before {
      content: '';
      position: absolute;
      width: 20px;
      height: 20px;
      left: 2px;
      top: 2px;
      border-radius: 50%;
      background-color: #ffffff;
      box-shadow: 0 1px 2px rgba(31, 35, 40, 0.2);
      transition: transform 0.2s ease;
    }

    .gdc-toggle-switch input:checked + .gdc-toggle-slider {
      background-color: #0969da;
    }

    .gdc-toggle-switch input:checked + .gdc-toggle-slider::before {
      transform: translateX(24px);
    }

    .gdc-toggle-status {
      font-size: 12px;
      color: #57606a;
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
  options: { isCustomMode?: boolean } = {}
): HTMLDivElement {
  console.log('Applying custom layout...', settings);

  ensureGlobalStyles();

  // 既存のダッシュボードをクリア
  clearDashboard();

  // ルートコンテナを作成
  const rootContainer = createRootContainer();

  // ヘッダーを作成
  const {
    header,
    toggleInput,
    modeLabel,
    loadingIndicator,
    loadingText,
  } = createHeader();
  layoutToggleInputRef = toggleInput;
  layoutModeLabelRef = modeLabel;
  headerLoadingIndicatorRef = loadingIndicator;
  headerLoadingTextRef = loadingText;

  const isCustomMode = options.isCustomMode ?? true;
  toggleInput.checked = isCustomMode;
  updateLayoutModeLabel(isCustomMode);

  rootContainer.appendChild(header);

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

  const toggleWrapper = createElement('div', {
    className: 'gdc-toggle-wrapper',
  });

  const toggleLabel = createElement('label', {
    className: 'gdc-toggle',
    attributes: {
      for: 'github-dashboard-layout-toggle',
    },
  });

  const originalOption = createElement('span', {
    className: 'gdc-toggle-option',
    textContent: 'オリジナル表示',
  });

  const toggleSwitch = createElement('span', {
    className: 'gdc-toggle-switch',
  });

  const toggleInput = createElement('input', {
    attributes: {
      type: 'checkbox',
      id: 'github-dashboard-layout-toggle',
      role: 'switch',
      'aria-label': '表示モードを切り替える',
    },
  }) as HTMLInputElement;

  const toggleSlider = createElement('span', {
    className: 'gdc-toggle-slider',
  });

  toggleSwitch.appendChild(toggleInput);
  toggleSwitch.appendChild(toggleSlider);

  const customOption = createElement('span', {
    className: 'gdc-toggle-option',
    textContent: 'アレンジ表示',
  });

  toggleLabel.appendChild(originalOption);
  toggleLabel.appendChild(toggleSwitch);
  toggleLabel.appendChild(customOption);

  const modeLabel = createElement('span', {
    className: 'gdc-toggle-status',
    textContent: '現在: アレンジ表示',
    attributes: {
      'aria-live': 'polite',
    },
  });

  toggleWrapper.appendChild(toggleLabel);
  toggleWrapper.appendChild(modeLabel);

  controls.appendChild(loadingIndicator);
  controls.appendChild(toggleWrapper);

  mainRow.appendChild(titleBlock);
  mainRow.appendChild(controls);
  header.appendChild(mainRow);

  return {
    header,
    toggleInput,
    modeLabel,
    loadingIndicator,
    loadingText,
  };
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
 * レイアウト切り替えトグル要素を取得
 */
export function getLayoutToggleInput(): HTMLInputElement | null {
  return layoutToggleInputRef;
}

/**
 * 表示モードラベルを更新
 * @param isCustomMode カスタム表示かどうか
 */
export function updateLayoutModeLabel(isCustomMode: boolean): void {
  if (!layoutModeLabelRef) {
    return;
  }

  layoutModeLabelRef.textContent = isCustomMode
    ? '現在: アレンジ表示'
    : '現在: オリジナル表示';
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

