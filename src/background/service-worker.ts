import { Message } from '../types/messages';
import {
  getSettings,
  saveSettings,
  saveToken as saveTokenToStorage,
  getToken,
} from '../utils/storage';
import {
  initApiClient,
  ApiError,
} from './api-client';
import { getCacheManager } from './cache-manager';
import {
  validateToken,
  fetchRepositories,
  fetchMentionedIssues,
  fetchProjects,
  groupRepositoriesByOrganization,
  sortRepositoriesByUpdated,
  sortIssuesByUpdated,
  sortProjectsByUpdated,
} from './github-api';

/**
 * Service Worker（Background Script）
 * Chrome拡張機能のバックグラウンド処理を担当
 */

console.log('Service Worker started');

/**
 * インストール時の処理
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
  if (details.reason === 'install') {
    // 初回インストール時の処理
    console.log('First time installation');
  } else if (details.reason === 'update') {
    // 更新時の処理
    console.log('Extension updated');
  }
});

/**
 * メッセージリスナー
 * Content ScriptやOptions Pageからのメッセージを処理
 */
chrome.runtime.onMessage.addListener(
  (
    message: Message,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    console.log('Message received:', message.type);

    // 非同期処理を行うため、trueを返す
    handleMessage(message)
      .then((response) => {
        sendResponse({ success: true, data: response });
      })
      .catch((error) => {
        console.error('Error handling message:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return true; // 非同期レスポンスを示す
  }
);

/**
 * メッセージハンドラー
 * @param message 受信したメッセージ
 * @returns Promise<unknown>
 */
async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'GET_SETTINGS':
      return await handleGetSettings();

    case 'SAVE_SETTINGS':
      return await handleSaveSettings(message);

    case 'SAVE_TOKEN':
      return await handleSaveToken(message);

    case 'VALIDATE_TOKEN':
      return await handleValidateToken();

    case 'GET_DATA':
      return await handleGetData(message);

    case 'REFRESH_DATA':
      return await handleRefreshData();

    default:
      throw new Error(`Unknown message type: ${(message as Message).type}`);
  }
}

/**
 * 設定取得ハンドラー
 */
async function handleGetSettings() {
  const settings = await getSettings();
  return settings;
}

/**
 * 設定保存ハンドラー
 */
async function handleSaveSettings(message: Message) {
  if (message.type !== 'SAVE_SETTINGS') {
    throw new Error('Invalid message type');
  }

  await saveSettings(message.settings);

  // Content Scriptに設定更新を通知
  notifySettingsUpdated(message.settings);

  return { success: true };
}

/**
 * トークン保存ハンドラー
 */
async function handleSaveToken(message: Message) {
  if (message.type !== 'SAVE_TOKEN') {
    throw new Error('Invalid message type');
  }

  await saveTokenToStorage(message.token);
  return { success: true };
}

/**
 * トークン検証ハンドラー
 */
async function handleValidateToken() {
  try {
    const token = await getToken();

    if (!token) {
      return {
        valid: false,
        message: 'トークンが設定されていません',
      };
    }

    // APIクライアントを初期化
    const client = initApiClient(token);

    // トークンを検証
    const result = await validateToken(client);

    return result;
  } catch (error) {
    console.error('Token validation error:', error);
    return {
      valid: false,
      message:
        error instanceof Error ? error.message : '検証に失敗しました',
    };
  }
}

/**
 * データ取得ハンドラー
 */
async function handleGetData(message: Message) {
  if (message.type !== 'GET_DATA') {
    throw new Error('Invalid message type');
  }

  try {
    const token = await getToken();

    if (!token) {
      throw new Error('トークンが設定されていません');
    }

    // APIクライアントを初期化
    const client = initApiClient(token);
    const cache = getCacheManager();

    const dataType = message.dataType;
    const result: {
      repositories?: unknown[];
      issues?: unknown[];
      projects?: unknown[];
    } = {};

    // データタイプに応じてデータを取得
    if (dataType === 'all' || dataType === 'repositories') {
      const repositories = await fetchRepositories(client, cache);
      const grouped = groupRepositoriesByOrganization(repositories);

      // Organization別にソート
      const sortedByOrg: Record<string, unknown[]> = {};
      grouped.forEach((repos, org) => {
        sortedByOrg[org] = sortRepositoriesByUpdated(repos);
      });

      result.repositories = Object.entries(sortedByOrg).map(
        ([org, repos]) => ({
          organization: org,
          repositories: repos,
        })
      );
    }

    if (dataType === 'all' || dataType === 'issues') {
      const issues = await fetchMentionedIssues(client, cache);
      result.issues = sortIssuesByUpdated(issues);
    }

    if (dataType === 'all' || dataType === 'projects') {
      const projects = await fetchProjects(client, cache);
      result.projects = sortProjectsByUpdated(projects);
    }

    return result;
  } catch (error) {
    console.error('Data fetch error:', error);

    if (error instanceof ApiError) {
      throw new Error(
        `API Error (${error.status}): ${error.message}`
      );
    }

    throw error;
  }
}

/**
 * データ更新ハンドラー
 */
async function handleRefreshData() {
  try {
    // キャッシュをクリア
    const cache = getCacheManager();
    await cache.clearAll();

    console.log('Cache cleared, ready for refresh');

    return { success: true, message: 'キャッシュをクリアしました' };
  } catch (error) {
    console.error('Refresh data error:', error);
    throw error;
  }
}

/**
 * 設定更新通知
 * すべてのタブのContent Scriptに設定変更を通知
 */
async function notifySettingsUpdated(settings: unknown) {
  try {
    const tabs = await chrome.tabs.query({
      url: ['https://github.com/', 'https://github.com/?*'],
    });

    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs
          .sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
            settings,
          })
          .catch((error) => {
            console.error('Failed to notify tab:', tab.id, error);
          });
      }
    }
  } catch (error) {
    console.error('Failed to notify settings updated:', error);
  }
}

