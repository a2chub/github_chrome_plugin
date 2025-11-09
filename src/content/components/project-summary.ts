import { Project } from '../../types/api';
import {
  createElement,
  createEmptyState,
  createErrorElement,
  formatRelativeTime,
} from '../dom-manipulator';

/**
 * プロジェクトサマリーコンポーネント
 */

/**
 * プロジェクトリストを描画
 * @param container 描画先のコンテナ要素
 * @param projects Project配列
 */
export function renderProjectSummary(
  container: HTMLElement,
  projects: Project[]
): void {
  // 既存のコンテンツをクリア
  container.innerHTML = '';

  if (!projects || projects.length === 0) {
    container.appendChild(createEmptyState('プロジェクトが見つかりませんでした'));
    return;
  }

  // プロジェクトリスト
  const list = createElement('div', {
    className: 'project-list',
    styles: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
  });

  projects.slice(0, 10).forEach((project) => {
    const projectItem = createProjectItem(project);
    list.appendChild(projectItem);
  });

  container.appendChild(list);
}

/**
 * プロジェクトアイテムを作成
 */
function createProjectItem(project: Project): HTMLElement {
  const item = createElement('div', {
    className: 'project-item',
    styles: {
      display: 'flex',
      flexDirection: 'column',
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

  // クリックでプロジェクトを開く
  item.addEventListener('click', () => {
    window.open(project.html_url, '_blank');
  });

  // ヘッダー部分
  const header = createElement('div', {
    className: 'project-header',
    styles: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '8px',
    },
  });

  // プロジェクト名
  const name = createElement('div', {
    textContent: project.name,
    className: 'project-name',
    styles: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#24292f',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flex: '1',
      minWidth: '0',
    },
  });
  header.appendChild(name);

  // 状態バッジ
  const stateBadge = createStateBadge(project.state);
  header.appendChild(stateBadge);

  item.appendChild(header);

  // 説明
  if (project.body) {
    const description = createElement('div', {
      textContent: project.body,
      className: 'project-description',
      styles: {
        fontSize: '12px',
        color: '#57606a',
        marginBottom: '8px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        webkitLineClamp: '2',
        webkitBoxOrient: 'vertical',
      },
    });
    item.appendChild(description);
  }

  // メタ情報
  const meta = createElement('div', {
    className: 'project-meta',
    styles: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '12px',
      color: '#57606a',
    },
  });

  // 作成者
  if (project.creator) {
    const creator = createElement('span', {
      textContent: `作成者: ${project.creator.login}`,
      className: 'project-creator',
    });
    meta.appendChild(creator);
    meta.appendChild(createElement('span', { textContent: '•' }));
  }

  // 更新日時
  const updated = createElement('span', {
    textContent: `更新: ${formatRelativeTime(project.updated_at)}`,
    className: 'project-updated',
  });
  meta.appendChild(updated);

  item.appendChild(meta);

  return item;
}

/**
 * 状態バッジを作成
 */
function createStateBadge(state: 'open' | 'closed'): HTMLElement {
  const badge = createElement('span', {
    textContent: state === 'open' ? 'オープン' : 'クローズ',
    className: `project-state-badge state-${state}`,
    styles: {
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: '500',
      flexShrink: '0',
    },
  });

  if (state === 'open') {
    badge.style.backgroundColor = '#ddf4e4';
    badge.style.color = '#116329';
  } else {
    badge.style.backgroundColor = '#e1e4e8';
    badge.style.color = '#57606a';
  }

  return badge;
}

/**
 * エラー表示
 */
export function renderProjectError(
  container: HTMLElement,
  error: string
): void {
  container.innerHTML = '';
  container.appendChild(createErrorElement(error));
}

