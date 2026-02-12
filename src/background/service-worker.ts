import { Message } from '../types/messages';
import { logger } from '../utils/logger';
import { handleMessage } from './message-handlers';

/**
 * Service Worker（Background Script）
 * Chrome拡張機能のバックグラウンド処理を担当
 */

logger.info('Service Worker started');

/**
 * インストール時の処理
 */
chrome.runtime.onInstalled.addListener((details) => {
  logger.info('Extension installed:', details.reason);
  if (details.reason === 'install') {
    // 初回インストール時の処理
    logger.info('First time installation');
  } else if (details.reason === 'update') {
    // 更新時の処理
    logger.info('Extension updated');
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
    logger.debug('Message received:', message.type);

    // 非同期処理を行うため、trueを返す
    handleMessage(message)
      .then((response) => {
        sendResponse({ success: true, data: response });
      })
      .catch((error) => {
        logger.error('Error handling message:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return true; // 非同期レスポンスを示す
  }
);
