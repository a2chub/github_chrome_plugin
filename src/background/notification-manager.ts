import { logger } from '../utils/logger';

/**
 * 設定更新通知
 * すべてのタブのContent Scriptに設定変更を通知
 */
export async function notifySettingsUpdated(settings: unknown) {
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
                        logger.error('Failed to notify tab:', tab.id, error);
                    });
            }
        }
    } catch (error) {
        logger.error('Failed to notify settings updated:', error);
    }
}
