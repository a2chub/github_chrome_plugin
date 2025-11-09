import { GitHubError, RateLimit } from '../types/api';

/**
 * GitHub APIクライアント
 * GitHub APIとの通信を担当
 */

const GITHUB_API_BASE_URL = 'https://api.github.com';
const DEFAULT_TIMEOUT = 30000; // 30秒
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1秒

/**
 * APIリクエストのオプション
 */
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

/**
 * APIレスポンス
 */
export interface ApiResponse<T = unknown> {
  data: T;
  rateLimit?: RateLimit;
  status: number;
  headers: Headers;
}

/**
 * APIエラー
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: GitHubError
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * GitHub APIクライアントクラス
 */
export class GitHubApiClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * トークンを設定
   * @param token Personal Access Token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * GETリクエスト
   * @param endpoint APIエンドポイント
   * @param options リクエストオプション
   * @returns Promise<ApiResponse<T>>
   */
  async get<T = unknown>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * APIリクエスト（リトライ機能付き）
   * @param endpoint APIエンドポイント
   * @param options リクエストオプション
   * @param retryCount 現在のリトライ回数
   * @returns Promise<ApiResponse<T>>
   */
  async request<T = unknown>(
    endpoint: string,
    options: ApiRequestOptions = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${GITHUB_API_BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `token ${this.token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const requestInit: RequestInit = {
      method: options.method || 'GET',
      headers,
    };

    if (options.body) {
      requestInit.body = JSON.stringify(options.body);
    }

    try {
      const controller = new AbortController();
      const timeout = options.timeout || DEFAULT_TIMEOUT;

      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...requestInit,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // レートリミット情報を取得
      const rateLimit = this.extractRateLimit(response.headers);

      // ステータスコードのチェック
      if (!response.ok) {
        return this.handleErrorResponse(
          response,
          endpoint,
          options,
          retryCount
        );
      }

      // レスポンスボディをパース
      const data = await response.json();

      return {
        data,
        rateLimit,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      // ネットワークエラーまたはタイムアウト
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408);
      }

      // リトライ処理
      if (retryCount < MAX_RETRIES) {
        const delay = this.calculateRetryDelay(retryCount);
        console.log(
          `Retrying request after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
        );
        await this.sleep(delay);
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      throw new ApiError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        0
      );
    }
  }

  /**
   * エラーレスポンスを処理
   */
  private async handleErrorResponse<T>(
    response: Response,
    endpoint: string,
    options: ApiRequestOptions,
    retryCount: number
  ): Promise<ApiResponse<T>> {
    const status = response.status;

    // エラーレスポンスボディを取得
    let errorResponse: GitHubError | undefined;
    try {
      errorResponse = await response.json();
    } catch {
      // JSONパースエラー
    }

    // 429 Too Many Requests（レートリミット超過）
    if (status === 429) {
      const resetTime = response.headers.get('X-RateLimit-Reset');
      const retryAfter = response.headers.get('Retry-After');

      if (retryCount < MAX_RETRIES) {
        let delay: number;
        if (retryAfter) {
          delay = parseInt(retryAfter, 10) * 1000;
        } else if (resetTime) {
          const resetTimestamp = parseInt(resetTime, 10) * 1000;
          delay = Math.max(0, resetTimestamp - Date.now());
        } else {
          delay = this.calculateRetryDelay(retryCount);
        }

        console.log(`Rate limited. Retrying after ${delay}ms`);
        await this.sleep(delay);
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      throw new ApiError(
        errorResponse?.message || 'Rate limit exceeded',
        status,
        errorResponse
      );
    }

    // 500番台のサーバーエラー（リトライ可能）
    if (status >= 500 && retryCount < MAX_RETRIES) {
      const delay = this.calculateRetryDelay(retryCount);
      console.log(
        `Server error (${status}). Retrying after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
      );
      await this.sleep(delay);
      return this.request<T>(endpoint, options, retryCount + 1);
    }

    // その他のエラー
    throw new ApiError(
      errorResponse?.message || `HTTP ${status}`,
      status,
      errorResponse
    );
  }

  /**
   * レートリミット情報を抽出
   */
  private extractRateLimit(headers: Headers): RateLimit {
    return {
      limit: parseInt(headers.get('X-RateLimit-Limit') || '0', 10),
      remaining: parseInt(headers.get('X-RateLimit-Remaining') || '0', 10),
      reset: parseInt(headers.get('X-RateLimit-Reset') || '0', 10),
      used: parseInt(headers.get('X-RateLimit-Used') || '0', 10),
    };
  }

  /**
   * リトライ待機時間を計算（指数バックオフ）
   */
  private calculateRetryDelay(retryCount: number): number {
    return INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
  }

  /**
   * 待機処理
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * APIクライアントのシングルトンインスタンス
 */
let apiClientInstance: GitHubApiClient | null = null;

/**
 * APIクライアントを初期化
 * @param token Personal Access Token
 */
export function initApiClient(token: string): GitHubApiClient {
  apiClientInstance = new GitHubApiClient(token);
  return apiClientInstance;
}

/**
 * APIクライアントインスタンスを取得
 * @returns GitHubApiClient
 */
export function getApiClient(): GitHubApiClient {
  if (!apiClientInstance) {
    throw new Error('API client not initialized. Call initApiClient() first.');
  }
  return apiClientInstance;
}

