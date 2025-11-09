import { Settings, DEFAULT_SETTINGS } from '../types/settings';

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
    await chrome.storage.local.set({ settings });
  } catch (error) {
    console.error('Failed to save settings:', error);
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
    return result.settings || DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
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
    console.error('Failed to save token:', error);
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
    console.error('Failed to get token:', error);
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
    console.error(`Failed to save data for key "${key}":`, error);
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
    console.error(`Failed to get data for key "${key}":`, error);
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
    console.error(`Failed to remove data for key "${key}":`, error);
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
    console.error('Failed to clear all data:', error);
    throw new Error('すべてのデータのクリアに失敗しました');
  }
}

