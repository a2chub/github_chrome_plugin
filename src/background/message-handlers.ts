import { Message } from '../types/messages';
import { logger } from '../utils/logger';
import { Repository, GroupedRepository } from '../types/api';
import {
    getSettings,
    saveSettings,
    saveToken as saveTokenToStorage,
    getToken,
    removeDashboardSnapshot,
} from '../utils/storage';
import {
    initApiClient,
    ApiError,
} from '../utils/api-client';
import { getCacheManager } from '../utils/cache-manager';
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
import { RepositoryDisplaySettings } from '../types/settings';
import { notifySettingsUpdated } from './notification-manager';

/**
 * メッセージハンドラー
 * @param message 受信したメッセージ
 * @returns Promise<unknown>
 */
export async function handleMessage(message: Message): Promise<unknown> {
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

        if (result.valid && result.user) {
            // トークンが有効な場合、設定を保存
            const settings = await getSettings();
            settings.token = token;
            await saveSettings(settings);

            // データ取得
            const cacheManager = getCacheManager();
            const [repos, issues, projects] = await Promise.all([
                fetchRepositories(client, cacheManager),
                fetchMentionedIssues(client, cacheManager),
                fetchProjects(client, cacheManager),
            ]);

            return {
                ...result,
                repositories: groupRepositoriesByOrganization(repos),
                issues: issues,
                projects: projects,
            };
        }

        return result;
    } catch (error) {
        logger.error('Token validation error:', error);
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
        const settings = await getSettings();
        const repositoryPreferences = settings.preferences.repositories;

        const dataType = message.dataType;
        const result: {
            repositories?: unknown[];
            issues?: unknown[];
            projects?: unknown[];
        } = {};

        // データタイプに応じてデータを取得
        if (dataType === 'all') {
            // 全データを並列取得（部分的な失敗を許容）
            const results = await Promise.allSettled([
                fetchRepositories(client, cache),
                fetchMentionedIssues(client, cache),
                fetchProjects(client, cache),
            ]);

            if (results[0].status === 'fulfilled') {
                result.repositories = applyRepositoryPreferences(
                    results[0].value,
                    repositoryPreferences
                );
            } else {
                logger.error('Failed to fetch repositories:', results[0].reason);
            }

            if (results[1].status === 'fulfilled') {
                result.issues = sortIssuesByUpdated(results[1].value);
            } else {
                logger.error('Failed to fetch issues:', results[1].reason);
            }

            if (results[2].status === 'fulfilled') {
                result.projects = sortProjectsByUpdated(results[2].value);
            } else {
                logger.error('Failed to fetch projects:', results[2].reason);
            }
        } else {
            if (dataType === 'repositories') {
                const repositories = await fetchRepositories(client, cache);
                result.repositories = applyRepositoryPreferences(
                    repositories,
                    repositoryPreferences
                );
            }

            if (dataType === 'issues') {
                const issues = await fetchMentionedIssues(client, cache);
                result.issues = sortIssuesByUpdated(issues);
            }

            if (dataType === 'projects') {
                const projects = await fetchProjects(client, cache);
                result.projects = sortProjectsByUpdated(projects);
            }
        }

        return result;
    } catch (error) {
        logger.error('Data fetch error:', error);

        if (error instanceof ApiError) {
            throw new Error(
                `API Error (${error.status}): ${error.message}`
            );
        }

        throw error;
    }
}

function applyRepositoryPreferences(
    repositories: Repository[],
    preferences: RepositoryDisplaySettings
): GroupedRepository[] {
    const cutoff =
        preferences.updatedWithinDays > 0
            ? Date.now() - preferences.updatedWithinDays * 24 * 60 * 60 * 1000
            : null;

    const filteredByDate = repositories.filter((repo) => {
        if (!cutoff) {
            return true;
        }

        const updatedAt = Date.parse(repo.updated_at);
        if (Number.isNaN(updatedAt)) {
            return true;
        }

        return updatedAt >= cutoff;
    });

    const grouped = groupRepositoriesByOrganization(filteredByDate);
    const result: GroupedRepository[] = [];

    grouped.forEach((repos, org) => {
        const sorted = sortRepositoriesByUpdated(repos);
        const limited =
            preferences.perOrgLimit > 0
                ? sorted.slice(0, preferences.perOrgLimit)
                : sorted;

        if (limited.length > 0) {
            result.push({
                organization: org,
                repositories: limited,
            });
        }
    });

    return result;
}

/**
 * データ更新ハンドラー
 */
async function handleRefreshData() {
    try {
        // キャッシュをクリア
        const cache = getCacheManager();
        await cache.clearAll();
        await removeDashboardSnapshot();

        logger.info('Cache cleared, ready for refresh');

        return { success: true, message: 'キャッシュをクリアしました' };
    } catch (error) {
        logger.error('Refresh data error:', error);
        throw error;
    }
}
