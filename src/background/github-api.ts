import { User, Organization, Repository, Issue, Project } from '../types/api';
import { GitHubApiClient, ApiResponse } from './api-client';
import { CacheManager } from './cache-manager';

/**
 * GitHub API機能
 * GitHub APIを使用して各種データを取得する機能を提供
 */

/**
 * ユーザー情報を取得
 * @param client APIクライアント
 * @param cache キャッシュマネージャー
 * @returns Promise<User>
 */
export async function fetchUser(
  client: GitHubApiClient,
  cache: CacheManager
): Promise<User> {
  const cacheKey = 'user';

  // キャッシュをチェック
  const cached = await cache.get<User>(cacheKey);
  if (cached) {
    return cached;
  }

  // APIから取得
  console.log('Fetching user from API...');
  const response: ApiResponse<User> = await client.get('/user');

  // キャッシュに保存（5分）
  await cache.set(cacheKey, response.data, 5 * 60);

  return response.data;
}

/**
 * Organization一覧を取得
 * @param client APIクライアント
 * @param cache キャッシュマネージャー
 * @returns Promise<Organization[]>
 */
export async function fetchOrganizations(
  client: GitHubApiClient,
  cache: CacheManager
): Promise<Organization[]> {
  const cacheKey = 'organizations';

  // キャッシュをチェック
  const cached = await cache.get<Organization[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // APIから取得
  console.log('Fetching organizations from API...');
  const response: ApiResponse<Organization[]> = await client.get('/user/orgs');

  // キャッシュに保存（5分）
  await cache.set(cacheKey, response.data, 5 * 60);

  return response.data;
}

/**
 * リポジトリ一覧を取得
 * @param client APIクライアント
 * @param cache キャッシュマネージャー
 * @returns Promise<Repository[]>
 */
export async function fetchRepositories(
  client: GitHubApiClient,
  cache: CacheManager
): Promise<Repository[]> {
  const cacheKey = 'repositories';

  // キャッシュをチェック
  const cached = await cache.get<Repository[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // APIから取得
  console.log('Fetching repositories from API...');
  
  const allRepos: Repository[] = [];
  let page = 1;
  const perPage = 100;
  
  // ページネーションで全リポジトリを取得
  while (true) {
    const response: ApiResponse<Repository[]> = await client.get(
      `/user/repos?sort=updated&per_page=${perPage}&page=${page}&affiliation=owner,collaborator,organization_member`
    );
    
    if (response.data.length === 0) {
      break;
    }
    
    allRepos.push(...response.data);
    
    // 100件未満の場合は最後のページ
    if (response.data.length < perPage) {
      break;
    }
    
    page++;
    
    // 安全のため、10ページ（1000件）までで停止
    if (page > 10) {
      console.warn('Reached maximum page limit (10 pages)');
      break;
    }
  }
  
  console.log(`Fetched ${allRepos.length} repositories`);

  // キャッシュに保存（5分）
  await cache.set(cacheKey, allRepos, 5 * 60);

  return allRepos;
}

/**
 * メンションされたIssue一覧を取得
 * @param client APIクライアント
 * @param cache キャッシュマネージャー
 * @returns Promise<Issue[]>
 */
export async function fetchMentionedIssues(
  client: GitHubApiClient,
  cache: CacheManager
): Promise<Issue[]> {
  const cacheKey = 'issues_mentioned';

  // キャッシュをチェック
  const cached = await cache.get<Issue[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // APIから取得
  console.log('Fetching mentioned issues from API...');
  const response: ApiResponse<Issue[]> = await client.get(
    '/issues?filter=mentioned&state=all&per_page=50'
  );

  // キャッシュに保存（5分）
  await cache.set(cacheKey, response.data, 5 * 60);

  return response.data;
}

/**
 * プロジェクト一覧を取得（ユーザーのプロジェクト）
 * 注: GitHub Projects V2 APIは別のエンドポイントを使用
 * @param client APIクライアント
 * @param cache キャッシュマネージャー
 * @returns Promise<Project[]>
 */
export async function fetchProjects(
  client: GitHubApiClient,
  cache: CacheManager
): Promise<Project[]> {
  const cacheKey = 'projects';

  // キャッシュをチェック
  const cached = await cache.get<Project[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // APIから取得
  // 注: GitHub Projects (Classic) のエンドポイント
  // Projects V2を使用する場合は別のエンドポイントを使用する必要がある
  console.log('Fetching projects from API...');

  try {
    const response: ApiResponse<Project[]> = await client.get('/user/projects', {
      headers: {
        Accept: 'application/vnd.github.inertia-preview+json',
      },
    });

    // キャッシュに保存（5分）
    await cache.set(cacheKey, response.data, 5 * 60);

    return response.data;
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    // プロジェクトAPIがエラーの場合は空配列を返す
    return [];
  }
}

/**
 * トークンの有効性を検証
 * @param client APIクライアント
 * @returns Promise<{ valid: boolean; message?: string; user?: User }>
 */
export async function validateToken(
  client: GitHubApiClient
): Promise<{ valid: boolean; message?: string; user?: User }> {
  try {
    console.log('Validating token...');
    const response: ApiResponse<User> = await client.get('/user');

    console.log('Token is valid:', response.data.login);

    return {
      valid: true,
      message: `認証成功: ${response.data.login}`,
      user: response.data,
    };
  } catch (error) {
    console.error('Token validation failed:', error);

    if (error instanceof Error) {
      return {
        valid: false,
        message: `認証失敗: ${error.message}`,
      };
    }

    return {
      valid: false,
      message: '認証失敗: 不明なエラー',
    };
  }
}

/**
 * Organization別にリポジトリをグループ化
 * @param repositories リポジトリ一覧
 * @returns Map<string, Repository[]>
 */
export function groupRepositoriesByOrganization(
  repositories: Repository[]
): Map<string, Repository[]> {
  const grouped = new Map<string, Repository[]>();

  repositories.forEach((repo) => {
    const org =
      repo.owner.type === 'Organization' ? repo.owner.login : 'Personal';

    if (!grouped.has(org)) {
      grouped.set(org, []);
    }

    grouped.get(org)?.push(repo);
  });

  return grouped;
}

/**
 * リポジトリを更新日時でソート
 * @param repositories リポジトリ一覧
 * @returns Repository[]
 */
export function sortRepositoriesByUpdated(
  repositories: Repository[]
): Repository[] {
  return [...repositories].sort((a, b) => {
    const dateA = new Date(a.updated_at).getTime();
    const dateB = new Date(b.updated_at).getTime();
    return dateB - dateA; // 降順（最新が上）
  });
}

/**
 * Issueを更新日時でソート
 * @param issues Issue一覧
 * @returns Issue[]
 */
export function sortIssuesByUpdated(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    const dateA = new Date(a.updated_at).getTime();
    const dateB = new Date(b.updated_at).getTime();
    return dateB - dateA; // 降順（最新が上）
  });
}

/**
 * プロジェクトを更新日時でソート
 * @param projects プロジェクト一覧
 * @returns Project[]
 */
export function sortProjectsByUpdated(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const dateA = new Date(a.updated_at).getTime();
    const dateB = new Date(b.updated_at).getTime();
    return dateB - dateA; // 降順（最新が上）
  });
}

