/**
 * レイアウトアイテムの定義
 */
export interface LayoutItem {
  id: string;
  enabled: boolean;
  order: number;
}

/**
 * キャッシュ設定の定義
 */
export interface CacheSettings {
  ttl: number; // Time to live in seconds
}

/**
 * キャッシュエントリの定義
 */
export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * 設定データの定義
 */
export interface Settings {
  layout: LayoutItem[];
  token: string;
  cache: {
    repositories?: CacheEntry;
    issues?: CacheEntry;
    projects?: CacheEntry;
  };
}

/**
 * デフォルト設定
 */
export const DEFAULT_SETTINGS: Settings = {
  layout: [
    { id: 'repositories', enabled: true, order: 0 },
    { id: 'issues', enabled: true, order: 1 },
    { id: 'projects', enabled: true, order: 2 },
  ],
  token: '',
  cache: {},
};

/**
 * デフォルトのキャッシュTTL（5分）
 */
export const DEFAULT_CACHE_TTL = 5 * 60; // 5 minutes in seconds

