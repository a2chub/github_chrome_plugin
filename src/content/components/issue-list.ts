import { Issue, Label } from '../../types/api';
import {
  createElement,
  createEmptyState,
  createErrorElement,
  formatRelativeTime,
} from '../dom-manipulator';

/**
 * Issueリストコンポーネント
 */

/**
 * Issueリストを描画
 * @param container 描画先のコンテナ要素
 * @param issues Issue配列
 */
export function renderIssueList(
  container: HTMLElement,
  issues: Issue[]
): void {
  // 既存のコンテンツをクリア
  container.innerHTML = '';

  if (!issues || issues.length === 0) {
    container.appendChild(createEmptyState('メンションされたIssueが見つかりませんでした'));
    return;
  }

  // Issueリスト
  const list = createElement('div', {
    className: 'issue-list',
    styles: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
  });

  issues.slice(0, 20).forEach((issue) => {
    const issueItem = createIssueItem(issue);
    list.appendChild(issueItem);
  });

  container.appendChild(list);
}

/**
 * Issueアイテムを作成
 */
function createIssueItem(issue: Issue): HTMLElement {
  const item = createElement('div', {
    className: 'issue-item',
    styles: {
      display: 'flex',
      alignItems: 'flex-start',
      padding: '12px',
      borderRadius: '6px',
      border: '1px solid #d0d7de',
      backgroundColor: '#ffffff',
      transition: 'background-color 0.2s, border-color 0.2s',
      cursor: 'pointer',
    },
  });

  // hover効果
  item.addEventListener('mouseenter', () => {
    item.style.backgroundColor = '#f6f8fa';
    item.style.borderColor = '#0969da';
  });
  item.addEventListener('mouseleave', () => {
    item.style.backgroundColor = '#ffffff';
    item.style.borderColor = '#d0d7de';
  });

  // クリックでIssueを開く
  item.addEventListener('click', () => {
    window.open(issue.html_url, '_blank');
  });

  // 左側: 状態アイコン
  const stateIcon = createStateIcon(issue.state);
  item.appendChild(stateIcon);

  // 右側: Issue情報
  const content = createElement('div', {
    className: 'issue-content',
    styles: {
      flex: '1',
      minWidth: '0',
    },
  });

  // タイトル
  const title = createElement('div', {
    textContent: issue.title,
    className: 'issue-title',
    styles: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#24292f',
      marginBottom: '4px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: '-webkit-box',
      webkitLineClamp: '2',
      webkitBoxOrient: 'vertical',
    },
  });
  content.appendChild(title);

  // メタ情報
  const meta = createElement('div', {
    className: 'issue-meta',
    styles: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '12px',
      color: '#57606a',
      flexWrap: 'wrap',
    },
  });

  // リポジトリ名
  const repoName = getRepositoryName(issue);
  if (repoName) {
    const repo = createElement('span', {
      textContent: repoName,
      className: 'issue-repo',
      styles: {
        fontWeight: '600',
      },
    });
    meta.appendChild(repo);
    meta.appendChild(createElement('span', { textContent: '•' }));
  }

  // Issue番号
  const number = createElement('span', {
    textContent: `#${issue.number}`,
    className: 'issue-number',
  });
  meta.appendChild(number);
  meta.appendChild(createElement('span', { textContent: '•' }));

  // 更新日時
  const updated = createElement('span', {
    textContent: formatRelativeTime(issue.updated_at),
    className: 'issue-updated',
  });
  meta.appendChild(updated);

  // ラベル
  if (issue.labels && issue.labels.length > 0) {
    meta.appendChild(createElement('span', { textContent: '•' }));
    issue.labels.slice(0, 3).forEach((label: Label) => {
      const labelElem = createLabelBadge(label.name, label.color);
      meta.appendChild(labelElem);
    });
  }

  content.appendChild(meta);
  item.appendChild(content);

  return item;
}

/**
 * 状態アイコンを作成
 */
function createStateIcon(state: 'open' | 'closed'): HTMLElement {
  const icon = createElement('div', {
    className: `state-icon state-${state}`,
    styles: {
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      marginRight: '12px',
      marginTop: '2px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      flexShrink: '0',
    },
  });

  if (state === 'open') {
    icon.style.backgroundColor = '#1a7f37';
    icon.style.color = '#ffffff';
    icon.textContent = '●';
  } else {
    icon.style.backgroundColor = '#8250df';
    icon.style.color = '#ffffff';
    icon.textContent = '✓';
  }

  return icon;
}

/**
 * ラベルバッジを作成
 */
function createLabelBadge(name: string, color: string): HTMLElement {
  const badge = createElement('span', {
    textContent: name,
    className: 'issue-label',
    styles: {
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: '500',
    },
  });

  // 背景色を設定
  badge.style.backgroundColor = `#${color}`;

  // テキスト色を自動調整（明暗に応じて）
  const brightness = getBrightness(color);
  badge.style.color = brightness > 128 ? '#24292f' : '#ffffff';

  return badge;
}

/**
 * 色の明るさを計算
 */
function getBrightness(hexColor: string): number {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Issueからリポジトリ名を取得
 */
function getRepositoryName(issue: Issue): string | null {
  if (issue.repository) {
    return issue.repository.full_name || issue.repository.name;
  }

  // repository_urlからリポジトリ名を抽出
  if (issue.repository_url) {
    const match = issue.repository_url.match(/repos\/(.+)$/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * エラー表示
 */
export function renderIssueError(
  container: HTMLElement,
  error: string
): void {
  container.innerHTML = '';
  container.appendChild(createErrorElement(error));
}

