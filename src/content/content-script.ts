import { Message, SettingsUpdatedMessage } from '../types/messages';
import { Settings } from '../types/settings';
import {
  applyLayout,
  rebuildLayout,
  renderSectionData,
  renderSectionError,
} from './layout-renderer';
import { createNotificationBanner } from './dom-manipulator';

/**
 * Content Script
 * GitHubダッシュボードページに注入され、DOMを操作する
 */

console.log('GitHub Dashboard Customizer: Content Script loaded');

let currentSettings: Settings | null = null;

/**
 * 初期化処理
 */
async function init() {
  console.log('Initializing content script...');

  // GitHubダッシュボードページかどうか確認
  if (!isGitHubDashboard()) {
    console.log('Not a GitHub dashboard page');
    return;
  }

  console.log('GitHub dashboard detected');

  // 設定を取得
  await loadSettings();

  // ページが完全に読み込まれてからDOM操作を開始
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DOM loaded');
      applyCustomizations();
    });
  } else {
    console.log('DOM already loaded');
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
      console.log('Settings loaded:', currentSettings);
    } else {
      console.error('Failed to load settings:', response.error);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/**
 * カスタマイズを適用
 */
async function applyCustomizations() {
  if (!currentSettings) {
    console.warn('No settings available');
    return;
  }

  console.log('Applying customizations...');

  // レイアウトを適用
  try {
    applyLayout(currentSettings);
    console.log('Layout applied successfully');

    // PATが設定されているかチェック
    if (!currentSettings.token || currentSettings.token.trim() === '') {
      // PATが未設定の場合、通知バナーを表示
      showTokenRequiredBanner();
      return;
    }

    // データを取得して表示
    await fetchAndRenderData();
  } catch (error) {
    console.error('Failed to apply layout:', error);
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
 * データを取得して描画
 */
async function fetchAndRenderData() {
  try {
    console.log('Fetching data...');

    const response = await chrome.runtime.sendMessage({
      type: 'GET_DATA',
      dataType: 'all',
    } as Message);

    if (response.success) {
      console.log('Data fetched:', response.data);
      renderData(response.data);
    } else {
      console.error('Failed to fetch data:', response.error);
      // エラーを各セクションに表示
      showDataError(response.error || 'データの取得に失敗しました');
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    showDataError(
      error instanceof Error ? error.message : 'データの取得に失敗しました'
    );
  }
}

/**
 * データを描画
 */
function renderData(data: {
  repositories?: unknown[];
  issues?: unknown[];
  projects?: unknown[];
}) {
  // リポジトリデータを描画
  if (data.repositories) {
    renderSectionData('section-repositories', {
      repositories: data.repositories as never,
    });
  }

  // Issueデータを描画
  if (data.issues) {
    renderSectionData('section-issues', {
      issues: data.issues as never,
    });
  }

  // プロジェクトデータを描画
  if (data.projects) {
    renderSectionData('section-projects', {
      projects: data.projects as never,
    });
  }
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
    console.log('Message received in content script:', message.type);

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
  console.log('Settings updated:', message.settings);
  currentSettings = message.settings;

  // レイアウトを再構築
  try {
    rebuildLayout(currentSettings);
    console.log('Layout rebuilt successfully');

    // データを再取得して表示
    await fetchAndRenderData();
  } catch (error) {
    console.error('Failed to rebuild layout:', error);
  }
}

// 初期化実行
init();

