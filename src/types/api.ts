/**
 * GitHub API レスポンスの型定義
 */

/**
 * GitHubリポジトリの定義
 */
export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    type: string;
  };
  html_url: string;
  description: string | null;
  private: boolean;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  language: string | null;
}

/**
 * GitHubユーザーの定義
 */
export interface User {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  email: string | null;
}

/**
 * GitHub Organizationの定義
 */
export interface Organization {
  login: string;
  id: number;
  avatar_url: string;
  description: string | null;
}

/**
 * GitHub Issueの定義
 */
export interface Issue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  repository_url: string;
  user: User;
  labels: Label[];
  created_at: string;
  updated_at: string;
  repository?: {
    name: string;
    full_name: string;
  };
}

/**
 * GitHub Labelの定義
 */
export interface Label {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

/**
 * GitHub Projectの定義
 */
export interface Project {
  id: number;
  name: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
  creator: User;
}

/**
 * APIレートリミット情報
 */
export interface RateLimit {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

/**
 * GitHub API エラーレスポンス
 */
export interface GitHubError {
  message: string;
  documentation_url?: string;
}

