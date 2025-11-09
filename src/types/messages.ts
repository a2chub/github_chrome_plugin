import { Settings } from './settings';
import { Repository, Issue, Project } from './api';

/**
 * メッセージタイプの定義
 */
export type MessageType =
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'SETTINGS_UPDATED'
  | 'GET_DATA'
  | 'DATA_RESPONSE'
  | 'SAVE_TOKEN'
  | 'VALIDATE_TOKEN'
  | 'TOKEN_VALIDATED'
  | 'ERROR'
  | 'REFRESH_DATA';

/**
 * データタイプの定義
 */
export type DataType = 'repositories' | 'issues' | 'projects' | 'all';

/**
 * 基本メッセージインターフェース
 */
export interface BaseMessage {
  type: MessageType;
}

/**
 * 設定取得要求メッセージ
 */
export interface GetSettingsMessage extends BaseMessage {
  type: 'GET_SETTINGS';
}

/**
 * 設定保存要求メッセージ
 */
export interface SaveSettingsMessage extends BaseMessage {
  type: 'SAVE_SETTINGS';
  settings: Settings;
}

/**
 * 設定更新通知メッセージ
 */
export interface SettingsUpdatedMessage extends BaseMessage {
  type: 'SETTINGS_UPDATED';
  settings: Settings;
}

/**
 * データ取得要求メッセージ
 */
export interface GetDataMessage extends BaseMessage {
  type: 'GET_DATA';
  dataType: DataType;
}

/**
 * データレスポンスメッセージ
 */
export interface DataResponseMessage extends BaseMessage {
  type: 'DATA_RESPONSE';
  dataType: DataType;
  data: {
    repositories?: Repository[];
    issues?: Issue[];
    projects?: Project[];
  };
}

/**
 * トークン保存要求メッセージ
 */
export interface SaveTokenMessage extends BaseMessage {
  type: 'SAVE_TOKEN';
  token: string;
}

/**
 * トークン検証要求メッセージ
 */
export interface ValidateTokenMessage extends BaseMessage {
  type: 'VALIDATE_TOKEN';
}

/**
 * トークン検証結果メッセージ
 */
export interface TokenValidatedMessage extends BaseMessage {
  type: 'TOKEN_VALIDATED';
  valid: boolean;
  message?: string;
}

/**
 * エラーメッセージ
 */
export interface ErrorMessage extends BaseMessage {
  type: 'ERROR';
  error: string;
  details?: unknown;
}

/**
 * データ更新要求メッセージ
 */
export interface RefreshDataMessage extends BaseMessage {
  type: 'REFRESH_DATA';
}

/**
 * すべてのメッセージ型のユニオン型
 */
export type Message =
  | GetSettingsMessage
  | SaveSettingsMessage
  | SettingsUpdatedMessage
  | GetDataMessage
  | DataResponseMessage
  | SaveTokenMessage
  | ValidateTokenMessage
  | TokenValidatedMessage
  | ErrorMessage
  | RefreshDataMessage;

