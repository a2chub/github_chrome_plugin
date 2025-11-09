/**
 * ログユーティリティ
 * 開発環境と本番環境でログレベルを切り替える
 */

/**
 * ログレベル
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * 現在のログレベル
 * 開発環境ではDEBUG、本番環境ではERRORに設定
 * 本番ビルド時にはERRORに変更してください
 */
const currentLogLevel: LogLevel = LogLevel.DEBUG;

/**
 * ログ出力クラス
 */
class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  /**
   * DEBUGログを出力
   */
  debug(...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.log(`[${this.prefix}] [DEBUG]`, ...args);
    }
  }

  /**
   * INFOログを出力
   */
  info(...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(`[${this.prefix}] [INFO]`, ...args);
    }
  }

  /**
   * WARNログを出力
   */
  warn(...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(`[${this.prefix}] [WARN]`, ...args);
    }
  }

  /**
   * ERRORログを出力
   */
  error(...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(`[${this.prefix}] [ERROR]`, ...args);
    }
  }

  /**
   * エラー情報を詳細にログ出力
   */
  logError(error: unknown, context?: string): void {
    if (currentLogLevel <= LogLevel.ERROR) {
      const message = context ? `${context}:` : 'Error:';

      if (error instanceof Error) {
        console.error(`[${this.prefix}] [ERROR] ${message}`, {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      } else {
        console.error(`[${this.prefix}] [ERROR] ${message}`, error);
      }
    }
  }
}

/**
 * ロガーインスタンスを作成
 */
export function createLogger(prefix: string): Logger {
  return new Logger(prefix);
}

/**
 * グローバルロガー
 */
export const logger = createLogger('GitHubDashboardCustomizer');

