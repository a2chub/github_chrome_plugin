import {
  Settings,
  DEFAULT_SETTINGS,
  DisplayPreferences,
  RepositoryDisplaySettings,
  LayoutItem,
  CachedDashboardSnapshot,
} from '../types/settings';
import { logger } from './logger';

/**
 * Chrome Storage APIを使用した設定の保存・取得機能
 */

/**
 * 設定をStorageに保存する
 * @param settings 保存する設定
 * @returns Promise<void>
 */
export async function saveSettings(settings: Settings): Promise<void> {
  try {
    const normalized = normalizeSettings(settings);
    await chrome.storage.local.set({ settings: normalized });
  } catch (error) {
    logger.error('Failed to save settings:', error);
    throw new Error('設定の保存に失敗しました');
  }
}

/**
 * Storageから設定を取得する
 * @returns Promise<Settings>
 */
export async function getSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get('settings');
    return normalizeSettings(result.settings);
  } catch (error) {
    logger.error('Failed to get settings:', error);
    return normalizeSettings(undefined);
  }
}

/**
 * 設定オブジェクトを正規化して欠損値を補完
 * @param settings 任意の設定オブジェクト
 * @returns 正規化済み設定
 */
export function normalizeSettings(
  settings: Partial<Settings> | undefined
): Settings {
  const layout = normalizeLayout(settings?.layout);
  const cache = normalizeCache(settings?.cache);
  const preferences = normalizePreferences(settings?.preferences);

  return {
    layout,
    token:
      typeof settings?.token === 'string'
        ? settings.token
        : DEFAULT_SETTINGS.token,
    cache,
    preferences,
  };
}

function normalizeLayout(layout: LayoutItem[] | undefined): LayoutItem[] {
  if (!layout || !Array.isArray(layout)) {
    return DEFAULT_SETTINGS.layout.map((item) => ({ ...item }));
  }

  return layout.map((item, index) => {
    if (!item || typeof item !== 'object') {
      return { ...DEFAULT_SETTINGS.layout[index] };
    }

    return {
      id: item.id ?? DEFAULT_SETTINGS.layout[index]?.id ?? `item-${index}`,
      enabled:
        typeof item.enabled === 'boolean'
          ? item.enabled
          : DEFAULT_SETTINGS.layout[index]?.enabled ?? true,
      order:
        typeof item.order === 'number'
          ? item.order
          : DEFAULT_SETTINGS.layout[index]?.order ?? index,
    };
  });
}

function normalizeCache(
  cache:
    | {
      repositories?: Settings['cache']['repositories'];
      issues?: Settings['cache']['issues'];
      projects?: Settings['cache']['projects'];
    }
    | undefined
): Settings['cache'] {
  if (!cache || typeof cache !== 'object') {
    return {};
  }

  return {
    repositories: cache.repositories,
    issues: cache.issues,
    projects: cache.projects,
  };
}

function normalizePreferences(
  preferences: DisplayPreferences | undefined
): DisplayPreferences {
  const repoSettings = normalizeRepositorySettings(preferences?.repositories);
  return {
    repositories: repoSettings,
  };
}

function normalizeRepositorySettings(
  repositories: RepositoryDisplaySettings | undefined
): RepositoryDisplaySettings {
  const defaults = DEFAULT_SETTINGS.preferences.repositories;

  const perOrgLimit =
    typeof repositories?.perOrgLimit === 'number' &&
      Number.isFinite(repositories.perOrgLimit) &&
      repositories.perOrgLimit >= 0
      ? Math.floor(repositories.perOrgLimit)
      : defaults.perOrgLimit;

  const updatedWithinDays =
    typeof repositories?.updatedWithinDays === 'number' &&
      Number.isFinite(repositories.updatedWithinDays) &&
      repositories.updatedWithinDays >= 0
      ? Math.floor(repositories.updatedWithinDays)
      : defaults.updatedWithinDays;

  return {
    perOrgLimit,
    updatedWithinDays,
  };
}

/**
 * Personal Access Tokenを保存する
 * @param token 保存するトークン
 * @returns Promise<void>
 */
export async function saveToken(token: string): Promise<void> {
  try {
    const settings = await getSettings();
    settings.token = token;
    await saveSettings(settings);
  } catch (error) {
    logger.error('Failed to save token:', error);
    throw new Error('トークンの保存に失敗しました');
  }
}

/**
 * Personal Access Tokenを取得する
 * @returns Promise<string>
 */
export async function getToken(): Promise<string> {
  try {
    const settings = await getSettings();
    return settings.token || '';
  } catch (error) {
    logger.error('Failed to get token:', error);
    return '';
  }
}

/**
 * 特定のキーのデータを保存する
 * @param key 保存するキー
 * @param data 保存するデータ
 * @returns Promise<void>
 */
export async function saveData<T>(key: string, data: T): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: data });
  } catch (error) {
    logger.error(`Failed to save data for key "${key}":`, error);
    throw new Error(`データの保存に失敗しました: ${key}`);
  }
}

/**
 * 特定のキーのデータを取得する
 * @param key 取得するキー
 * @returns Promise<T | null>
 */
export async function getData<T>(key: string): Promise<T | null> {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  } catch (error) {
    logger.error(`Failed to get data for key "${key}":`, error);
    return null;
  }
}

/**
 * 特定のキーのデータを削除する
 * @param key 削除するキー
 * @returns Promise<void>
 */
export async function removeData(key: string): Promise<void> {
  try {
    await chrome.storage.local.remove(key);
  } catch (error) {
    logger.error(`Failed to remove data for key "${key}":`, error);
    throw new Error(`データの削除に失敗しました: ${key}`);
  }
}

/**
 * すべてのデータをクリアする
 * @returns Promise<void>
 */
export async function clearAllData(): Promise<void> {
  try {
    await chrome.storage.local.clear();
  } catch (error) {
    logger.error('Failed to clear all data:', error);
    throw new Error('すべてのデータのクリアに失敗しました');
  }
}

const DASHBOARD_SNAPSHOT_KEY = 'lastDashboardSnapshot';

/**
 * ダッシュボードに表示する直近データのスナップショットを保存
 * @param snapshot 保存対象
 */
export async function saveDashboardSnapshot(
  snapshot: CachedDashboardSnapshot
): Promise<void> {
  try {
    await chrome.storage.local.set({
      [DASHBOARD_SNAPSHOT_KEY]: snapshot,
    });
  } catch (error) {
    logger.error('Failed to save dashboard snapshot:', error);
  }
}

/**
 * スナップショットを取得
 * @returns 保存済みスナップショットまたはnull
 */
export async function getDashboardSnapshot(): Promise<
  CachedDashboardSnapshot | null
> {
  try {
    const result = await chrome.storage.local.get(DASHBOARD_SNAPSHOT_KEY);
    const snapshot = result[DASHBOARD_SNAPSHOT_KEY];
    if (!snapshot || typeof snapshot !== 'object') {
      return null;
    }

    return snapshot as CachedDashboardSnapshot;
  } catch (error) {
    logger.error('Failed to get dashboard snapshot:', error);
    return null;
  }
}

/**
 * スナップショットを削除
 */
export async function removeDashboardSnapshot(): Promise<void> {
  try {
    await chrome.storage.local.remove(DASHBOARD_SNAPSHOT_KEY);
  } catch (error) {
    logger.error('Failed to remove dashboard snapshot:', error);
  }
}

