import { CacheEntry } from '../types/settings';
import { saveData, getData } from '../utils/storage';

/**
 * キャッシュマネージャー
 * APIレスポンスのキャッシュを管理
 */

/**
 * キャッシュキーのプレフィックス
 */
const CACHE_KEY_PREFIX = 'cache_';

/**
 * デフォルトのキャッシュTTL（5分）
 */
const DEFAULT_TTL = 5 * 60; // 5 minutes in seconds

/**
 * キャッシュマネージャークラス
 */
export class CacheManager {
  /**
   * キャッシュを保存
   * @param key キャッシュキー
   * @param data キャッシュするデータ
   * @param ttl Time to Live（秒）
   */
  async set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): Promise<void> {
    const cacheKey = this.getCacheKey(key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl * 1000, // ミリ秒に変換
    };

    try {
      await saveData(cacheKey, entry);
      console.log(`Cache saved: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`Failed to save cache for key "${key}":`, error);
    }
  }

  /**
   * キャッシュを取得
   * @param key キャッシュキー
   * @returns キャッシュされたデータ、または null
   */
  async get<T>(key: string): Promise<T | null> {
    const cacheKey = this.getCacheKey(key);

    try {
      const entry = await getData<CacheEntry<T>>(cacheKey);

      if (!entry) {
        console.log(`Cache miss: ${key}`);
        return null;
      }

      // TTLチェック
      const now = Date.now();
      const age = now - entry.timestamp;

      if (age > entry.ttl) {
        console.log(`Cache expired: ${key} (age: ${Math.floor(age / 1000)}s)`);
        // 期限切れのキャッシュを削除
        await this.delete(key);
        return null;
      }

      console.log(
        `Cache hit: ${key} (age: ${Math.floor(age / 1000)}s, TTL: ${Math.floor(entry.ttl / 1000)}s)`
      );
      return entry.data;
    } catch (error) {
      console.error(`Failed to get cache for key "${key}":`, error);
      return null;
    }
  }

  /**
   * キャッシュを削除
   * @param key キャッシュキー
   */
  async delete(key: string): Promise<void> {
    const cacheKey = this.getCacheKey(key);

    try {
      const { removeData } = await import('../utils/storage');
      await removeData(cacheKey);
      console.log(`Cache deleted: ${key}`);
    } catch (error) {
      console.error(`Failed to delete cache for key "${key}":`, error);
    }
  }

  /**
   * すべてのキャッシュをクリア
   */
  async clearAll(): Promise<void> {
    try {
      // Chrome Storage APIでキャッシュプレフィックスを持つすべてのキーを削除
      const storage = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(storage).filter((key) =>
        key.startsWith(CACHE_KEY_PREFIX)
      );

      if (cacheKeys.length > 0) {
        await chrome.storage.local.remove(cacheKeys);
        console.log(`Cleared ${cacheKeys.length} cache entries`);
      } else {
        console.log('No cache entries to clear');
      }
    } catch (error) {
      console.error('Failed to clear all cache:', error);
    }
  }

  /**
   * キャッシュキーを生成
   * @param key オリジナルのキー
   * @returns キャッシュキー
   */
  private getCacheKey(key: string): string {
    return `${CACHE_KEY_PREFIX}${key}`;
  }

  /**
   * キャッシュが存在し、有効かどうかチェック
   * @param key キャッシュキー
   * @returns 有効なキャッシュが存在する場合true
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  /**
   * キャッシュの情報を取得
   * @param key キャッシュキー
   * @returns キャッシュ情報
   */
  async getInfo(key: string): Promise<{
    exists: boolean;
    age?: number;
    ttl?: number;
    expired?: boolean;
  }> {
    const cacheKey = this.getCacheKey(key);

    try {
      const entry = await getData<CacheEntry>(cacheKey);

      if (!entry) {
        return { exists: false };
      }

      const now = Date.now();
      const age = now - entry.timestamp;
      const expired = age > entry.ttl;

      return {
        exists: true,
        age: Math.floor(age / 1000),
        ttl: Math.floor(entry.ttl / 1000),
        expired,
      };
    } catch (error) {
      console.error(`Failed to get cache info for key "${key}":`, error);
      return { exists: false };
    }
  }
}

/**
 * キャッシュマネージャーのシングルトンインスタンス
 */
let cacheManagerInstance: CacheManager | null = null;

/**
 * キャッシュマネージャーインスタンスを取得
 * @returns CacheManager
 */
export function getCacheManager(): CacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager();
  }
  return cacheManagerInstance;
}

