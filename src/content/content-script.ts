import { Message, SettingsUpdatedMessage } from '../types/messages';
import { logger } from '../utils/logger';
import { Settings } from '../types/settings';
import { GroupedRepository, Issue, Project } from '../types/api';
import {
  applyLayout,
  rebuildLayout,
  renderSectionData,
  renderSectionError,
  restoreDashboard,
  setHeaderLoadingState,
} from './layout-renderer';
import { createNotificationBanner } from '../utils/dom';
import { getDashboardSnapshot, saveDashboardSnapshot } from '../utils/storage';
import { CachedDashboardSnapshot } from '../types/settings';

/**
 * Content Script
 * GitHubダッシュボードページに注入され、DOMを操作する
 */

logger.info('GitHub Dashboard Customizer: Content Script loaded');

let currentSettings: Settings | null = null;
let isCustomLayoutActive = true;
let isFetchingData = false;
let pendingRefetch = false;
let hasCachedDataRendered = false;

/**
 * 初期化処理
 */
async function init() {
  logger.info('Initializing content script...');

  // GitHubダッシュボードページかどうか確認
  if (!isGitHubDashboard()) {
    logger.debug('Not a GitHub dashboard page');
    return;
  }

  logger.info('GitHub dashboard detected');

  // 設定を取得
  await loadSettings();

  // 初期状態で標準レイアウトの場合、トグルを表示
  if (!isCustomLayoutActive) {
    addLayoutToggleToSearchForm(false); // 標準レイアウトトグルを表示
  }

  // ページが完全に読み込まれてからDOM操作を開始
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      logger.debug('DOM loaded');
      applyCustomizations();
    });
  } else {
    logger.debug('DOM already loaded');
    applyCustomizations();
  }
}

/**
 * GitHubダッシュボードページかどうか確認
 */
function isGitHubDashboard(): boolean {
  const url = window.location.href;
  return (
    url === 'https://github.com/' ||
    url === 'https://github.com' ||
    url.startsWith('https://github.com/?')
  );
}

/**
 * 設定を読み込む
 */
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SETTINGS',
    } as Message);

    if (response.success) {
      currentSettings = response.data;
      logger.info('Settings loaded:', currentSettings);
    } else {
      logger.error('Failed to load settings:', response.error);
    }
  } catch (error) {
    logger.error('Error loading settings:', error);
  }
}

/**
 * カスタマイズを適用
 */
async function applyCustomizations() {
  if (!currentSettings) {
    logger.warn('No settings available');
    return;
  }

  if (!isCustomLayoutActive) {
    logger.info('Custom layout is disabled; skipping customization.');
    // 標準レイアウトの場合でもトグルを表示
    addLayoutToggleToSearchForm(false);
    return;
  }

  logger.info('Applying customizations...');

  // レイアウトを適用
  try {
    applyLayout(currentSettings, { isCustomMode: isCustomLayoutActive });
    addLayoutToggleToSearchForm(true);
    logger.info('Layout applied successfully');
    await renderCachedDashboardData();

    // PATが設定されているかチェック
    if (!currentSettings.token || currentSettings.token.trim() === '') {
      setHeaderLoadingState(false);
      // PATが未設定の場合、通知バナーを表示
      showTokenRequiredBanner();
      return;
    }

    // データを取得して表示（fire-and-forget: キャッシュ表示後にバックグラウンドで最新データを取得）
    fetchAndRenderData();
  } catch (error) {
    logger.error('Failed to apply layout:', error);
  }
}

/**
 * PAT未設定時の通知バナーを表示
 */
function showTokenRequiredBanner() {
  const container = document.getElementById('github-dashboard-customizer-root');
  if (!container) {
    return;
  }

  // 既存のバナーを削除
  const existingBanner = container.querySelector('.notification-banner');
  if (existingBanner) {
    existingBanner.remove();
  }

  // 通知バナーを作成
  const banner = createNotificationBanner({
    type: 'warning',
    title: 'GitHub Dashboard Customizer が有効です',
    message:
      'Personal Access Token (PAT) が設定されていません。設定ページでトークンを設定してください。',
    actionText: '設定を開く',
    onAction: () => {
      chrome.runtime.openOptionsPage();
    },
  });

  // コンテナの先頭に挿入
  container.insertBefore(banner, container.firstChild);

  // 各セクションに案内メッセージを表示
  const sections = ['section-repositories', 'section-issues', 'section-projects'];
  sections.forEach((sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      const content = section.querySelector('.section-content');
      if (content) {
        content.innerHTML = `
          <div style="padding: 24px; text-align: center; color: #57606a; font-size: 14px;">
            <p style="margin-bottom: 8px;">データを表示するには Personal Access Token の設定が必要です。</p>
            <p>上部の「設定を開く」ボタンから設定してください。</p>
          </div>
        `;
      }
    }
  });
}

/**
 * レイアウトモード切り替え時の処理
 */
function handleLayoutModeChange(useCustomLayout: boolean) {
  if (isCustomLayoutActive === useCustomLayout) {
    return;
  }

  isCustomLayoutActive = useCustomLayout;

  if (useCustomLayout) {
    addLayoutToggleToSearchForm(true); // カスタムレイアウトトグルを表示
    applyCustomizations();
  } else {
    teardownCustomLayout();
  }
}

/**
 * カスタムレイアウトを破棄してGitHub標準表示を復元
 */
function teardownCustomLayout() {
  logger.info('Disabling custom layout and restoring original dashboard...');

  setHeaderLoadingState(false);

  isFetchingData = false;
  pendingRefetch = false;
  hasCachedDataRendered = false;

  const root = document.getElementById('github-dashboard-customizer-root');
  if (root) {
    root.remove();
  }

  // サイドバーに挿入したセクションを削除
  document
    .querySelectorAll('.gdc-embedded-sidebar, #section-issues')
    .forEach((element) => element.remove());

  restoreDashboard();

  // 標準レイアウトに切り替えた後、トグルボタンを追加
  setTimeout(() => {
    addLayoutToggleToSearchForm(false);
  }, 100);
}

/**
 * データを取得して描画
 */
async function fetchAndRenderData() {
  if (!isCustomLayoutActive) {
    logger.debug('Custom layout disabled; skipping data fetch.');
    return;
  }

  if (isFetchingData) {
    pendingRefetch = true;
    logger.debug('Data fetch already in progress; queuing refetch.');
    return;
  }

  let fetchFailed = false;

  try {
    isFetchingData = true;
    setHeaderLoadingState(true);
    logger.info('Fetching data...');

    const response = await chrome.runtime.sendMessage({
      type: 'GET_DATA',
      dataType: 'all',
    } as Message);

    if (response.success) {
      logger.debug('Data fetched:', response.data);
      if (!isCustomLayoutActive) {
        logger.debug('Custom layout disabled during fetch; skipping render.');
        return;
      }
      await renderData(response.data);
      saveDashboardSnapshotFromData(response.data);
    } else {
      fetchFailed = true;
      logger.error('Failed to fetch data:', response.error);
      if (hasCachedDataRendered) {
        // staleデータが表示済みなので、データは消さずにヘッダーでエラーを通知
        setHeaderLoadingState(true, 'データの更新に失敗しました');
      } else {
        showDataError(response.error || 'データの取得に失敗しました');
      }
    }
  } catch (error) {
    fetchFailed = true;
    logger.error('Error fetching data:', error);
    if (hasCachedDataRendered) {
      setHeaderLoadingState(true, 'データの更新に失敗しました');
    } else {
      showDataError(
        error instanceof Error ? error.message : 'データの取得に失敗しました'
      );
    }
  } finally {
    isFetchingData = false;
    // エラー時にstaleデータを表示中の場合、エラーメッセージを維持する
    if (!(fetchFailed && hasCachedDataRendered)) {
      setHeaderLoadingState(false);
    }
    if (pendingRefetch) {
      pendingRefetch = false;
      fetchAndRenderData();
    }
  }
}

/**
 * データを描画
 */
async function renderData(data: {
  repositories?: GroupedRepository[];
  issues?: Issue[];
  projects?: Project[];
}): Promise<void> {
  // リポジトリデータを描画
  if (data.repositories) {
    await renderSectionData('section-repositories', {
      repositories: data.repositories,
    });
  }

  // Issueデータを描画
  if (data.issues) {
    await renderSectionData('section-issues', {
      issues: data.issues,
    });
  }

  // プロジェクトデータを描画
  if (data.projects) {
    await renderSectionData('section-projects', {
      projects: data.projects,
    });
  }
}

async function renderCachedDashboardData(): Promise<void> {
  if (!isCustomLayoutActive) {
    return;
  }

  const snapshot = await getDashboardSnapshot();
  if (!snapshot) {
    return;
  }

  const cachedData: {
    repositories?: GroupedRepository[];
    issues?: Issue[];
    projects?: Project[];
  } = {};

  if (snapshot.repositories?.data?.length) {
    cachedData.repositories = snapshot.repositories.data;
  }

  if (snapshot.issues?.data?.length) {
    cachedData.issues = snapshot.issues.data;
  }

  if (snapshot.projects?.data?.length) {
    cachedData.projects = snapshot.projects.data;
  }

  if (Object.keys(cachedData).length === 0) {
    return;
  }

  logger.debug('Rendering cached dashboard data:', {
    repositoriesUpdatedAt: snapshot.repositories?.updatedAt,
    issuesUpdatedAt: snapshot.issues?.updatedAt,
    projectsUpdatedAt: snapshot.projects?.updatedAt,
  });

  setHeaderLoadingState(true, 'キャッシュされたデータを表示しています…');
  await renderData(cachedData);
  hasCachedDataRendered = true;
}

/**
 * API取得成功後にダッシュボードスナップショットを保存する（fire-and-forget）
 */
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
  saveDashboardSnapshot(snapshot);
}

/**
 * データ取得エラーを表示
 */
function showDataError(error: string) {
  // 各セクションにエラーを表示
  renderSectionError('section-repositories', error);
  renderSectionError('section-issues', error);
  renderSectionError('section-projects', error);
}

/**
 * メッセージリスナー
 * Background Scriptからのメッセージを処理
 */
chrome.runtime.onMessage.addListener(
  (
    message: Message,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    logger.debug('Message received in content script:', message.type);

    if (message.type === 'SETTINGS_UPDATED') {
      handleSettingsUpdated(message as SettingsUpdatedMessage);
      sendResponse({ success: true });
    }

    return true;
  }
);

/**
 * 設定更新ハンドラー
 */
async function handleSettingsUpdated(message: SettingsUpdatedMessage) {
  logger.info('Settings updated:', message.settings);
  currentSettings = message.settings;

  if (!isCustomLayoutActive) {
    logger.info('Custom layout disabled; deferring layout rebuild until re-enabled.');
    return;
  }

  // レイアウトを再構築
  try {
    rebuildLayout(currentSettings, { isCustomMode: isCustomLayoutActive });
    addLayoutToggleToSearchForm(true);
    logger.info('Layout rebuilt successfully');

    // データを再取得して表示
    await fetchAndRenderData();
  } catch (error) {
    logger.error('Failed to rebuild layout:', error);
  }
}

// 共通のトグル配置関数
function addLayoutToggleToSearchForm(isCustomMode: boolean) {
  // 既存のトグルをすべて削除
  const existingToggles = [
    document.getElementById('github-standard-layout-toggle'),
    document.getElementById('github-custom-layout-toggle')
  ];
  existingToggles.forEach(toggle => toggle?.remove());

  // 検索フォームを探す
  const searchButton = document.querySelector('[data-target="qbsearch-input.inputButton"]') as HTMLElement;
  const searchForm = searchButton?.closest('form') ||
    document.querySelector('form[data-test-selector="nav-search-form"]') ||
    document.querySelector('.AppHeader-search');

  if (!searchButton && !searchForm) {
    logger.warn('Search form not found for layout toggle');
    return;
  }

  // 検索フォームの親コンテナを取得
  const searchContainer = searchButton?.parentElement || searchForm?.parentElement;
  if (!searchContainer) {
    logger.warn('Search container not found');
    return;
  }

  // トグルボタンを作成
  const toggleButton = document.createElement('button');
  toggleButton.id = isCustomMode ? 'github-custom-layout-toggle' : 'github-standard-layout-toggle';
  toggleButton.type = 'button';
  toggleButton.className = 'btn btn-sm';
  toggleButton.style.cssText = `
    margin-right: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 12px;
    height: 32px;
    padding: 0 12px;
    background-color: var(--color-btn-bg, #f6f8fa);
    border: 1px solid var(--color-btn-border, rgba(31, 35, 40, 0.15));
    border-radius: 6px;
    color: var(--color-btn-text, #24292f);
    cursor: pointer;
    transition: all 0.2s ease;
    vertical-align: middle;
    box-sizing: border-box;
    white-space: nowrap;
  `;

  // ホバー効果
  toggleButton.addEventListener('mouseenter', () => {
    toggleButton.style.backgroundColor = 'var(--color-btn-hover-bg, #f3f4f6)';
    toggleButton.style.borderColor = 'var(--color-btn-hover-border, rgba(31, 35, 40, 0.15))';
  });

  toggleButton.addEventListener('mouseleave', () => {
    toggleButton.style.backgroundColor = 'var(--color-btn-bg, #f6f8fa)';
    toggleButton.style.borderColor = 'var(--color-btn-border, rgba(31, 35, 40, 0.15))';
  });

  // テキストとアイコンを設定
  const buttonText = isCustomMode ? '標準表示' : 'カスタム表示';
  toggleButton.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M1.75 2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25v-10.5a.25.25 0 00-.25-.25H1.75zM0 2.75C0 1.784.784 1 1.75 1h12.5C15.216 1 16 1.784 16 2.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm4.5 6.5h7v-1h-7v1z"/>
    </svg>
    <span>${buttonText}</span>
  `;

  // クリックイベント
  toggleButton.addEventListener('click', () => {
    handleLayoutModeChange(!isCustomMode);
  });

  // 検索フォームの左側に挿入
  const insertionTarget =
    searchForm ||
    searchButton?.closest('.AppHeader-search') ||
    searchContainer.firstElementChild ||
    searchButton;

  const parent = insertionTarget?.parentElement;
  if (!insertionTarget || !parent) {
    logger.warn('Failed to determine insertion point for layout toggle');
    return;
  }

  parent.insertBefore(toggleButton, insertionTarget);
}

// 初期化実行
init();

