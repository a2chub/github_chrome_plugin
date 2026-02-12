import { Repository, GroupedRepository } from '../../types/api';
import { getData, saveData } from '../../utils/storage';
import {
  createElement,
  createEmptyState,
  createErrorElement,
  formatRelativeTime,
} from '../../utils/dom';

/**
 * リポジトリリストコンポーネント
 */

type AccordionState = Record<string, boolean>;

const ORG_ACCORDION_STORAGE_KEY = 'orgAccordionState';

let orgAccordionState: AccordionState = {};
let isAccordionStateLoaded = false;

async function ensureAccordionState(): Promise<AccordionState> {
  if (!isAccordionStateLoaded) {
    const storedState =
      (await getData<AccordionState>(ORG_ACCORDION_STORAGE_KEY)) || {};
    orgAccordionState = storedState;
    isAccordionStateLoaded = true;
  }
  return orgAccordionState;
}

async function persistAccordionState(): Promise<void> {
  try {
    await saveData(ORG_ACCORDION_STORAGE_KEY, orgAccordionState);
  } catch (error) {
    console.error('Failed to persist accordion state:', error);
  }
}

/**
 * リポジトリリストを描画
 * @param container 描画先のコンテナ要素
 * @param data グループ化されたリポジトリデータ
 */
export async function renderRepositoryList(
  container: HTMLElement,
  data: GroupedRepository[]
): Promise<void> {
  // 既存のコンテンツをクリア
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.appendChild(createEmptyState('リポジトリが見つかりませんでした'));
    return;
  }

  const accordionState = await ensureAccordionState();

  // Organization別にセクションを作成
  data.forEach((group) => {
    const orgSection = createOrganizationSection(group, accordionState);
    container.appendChild(orgSection);
  });
}

/**
 * Organizationセクションを作成
 */
function createOrganizationSection(
  group: GroupedRepository,
  accordionState: AccordionState
): HTMLElement {
  const section = createElement('div', {
    className: 'org-section',
    styles: {
      marginBottom: '16px',
    },
  });

  // Organization名のヘッダー
  const header = createElement('h3', {
    className: 'org-header',
    styles: {
      margin: '0',
      marginBottom: '8px',
    },
  });

  const toggleButton = createElement('button', {
    className: 'org-toggle-button',
    textContent: group.organization,
    attributes: {
      type: 'button',
    },
    styles: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '100%',
      fontSize: '16px',
      fontWeight: '600',
      color: '#24292f',
      backgroundColor: 'transparent',
      border: 'none',
      padding: '0 0 8px',
      borderBottom: '1px solid #d0d7de',
      cursor: 'pointer',
      textAlign: 'left',
    },
  });

  const toggleIcon = createElement('span', {
    className: 'org-toggle-icon',
    styles: {
      fontSize: '18px',
      lineHeight: '1',
      transition: 'transform 0.2s ease',
    },
  });

  const title = createElement('span', {
    textContent: group.organization,
    className: 'org-toggle-title',
    styles: {
      flex: '1',
    },
  });

  const countBadge = createElement('span', {
    textContent: `${group.repositories.length}件`,
    className: 'org-repo-count',
    styles: {
      fontSize: '12px',
      color: '#57606a',
    },
  });

  toggleButton.appendChild(toggleIcon);
  toggleButton.appendChild(title);
  toggleButton.appendChild(countBadge);
  header.appendChild(toggleButton);
  section.appendChild(header);

  // リポジトリリスト（2カラムグリッド）
  const list = createElement('div', {
    className: 'repo-list',
    styles: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '6px',
    },
  });

  group.repositories.forEach((repo) => {
    const repoItem = createRepositoryItem(repo);
    list.appendChild(repoItem);
  });

  section.appendChild(list);

  let isExpanded = accordionState[group.organization];
  if (isExpanded === undefined) {
    isExpanded = true;
  }

  function setExpanded(nextState: boolean) {
    isExpanded = nextState;
    accordionState[group.organization] = isExpanded;
    list.style.display = isExpanded ? 'grid' : 'none';
    toggleButton.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    toggleIcon.textContent = isExpanded ? '\u25BE' : '\u25B8';
    section.setAttribute('data-expanded', isExpanded ? 'true' : 'false');
  }

  function handleToggle() {
    setExpanded(!isExpanded);
    void persistAccordionState();
  }

  toggleButton.addEventListener('click', handleToggle);
  toggleButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggle();
    }
  });

  setExpanded(isExpanded);

  return section;
}

/**
 * リポジトリアイテムを作成
 */
function createRepositoryItem(repo: Repository): HTMLElement {
  const item = createElement('div', {
    className: 'repo-item',
    styles: {
      display: 'flex',
      flexDirection: 'column',
      padding: '6px 10px',
      borderRadius: '6px',
      border: '1px solid #d0d7de',
      backgroundColor: '#f6f8fa',
      transition: 'background-color 0.2s',
      cursor: 'pointer',
      minWidth: '0',
      gap: '2px',
    },
  });

  // hover効果
  item.addEventListener('mouseenter', () => {
    item.style.backgroundColor = '#eaeef2';
  });
  item.addEventListener('mouseleave', () => {
    item.style.backgroundColor = '#f6f8fa';
  });

  // クリックでリポジトリを開く
  item.addEventListener('click', () => {
    window.open(repo.html_url, '_blank');
  });

  // 1行目: リポジトリ名（全幅使用）
  const name = createElement('div', {
    textContent: repo.name,
    className: 'repo-name',
    styles: {
      fontSize: '13px',
      fontWeight: '600',
      color: '#0969da',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  });
  item.appendChild(name);

  // 2行目: メタ情報（言語・スター・更新日時）
  const meta = createElement('div', {
    className: 'repo-meta',
    styles: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '11px',
      color: '#57606a',
    },
  });

  if (repo.language) {
    const language = createElement('span', {
      textContent: repo.language,
      className: 'repo-language',
      styles: {
        padding: '1px 6px',
        borderRadius: '12px',
        backgroundColor: '#ddf4ff',
        color: '#0969da',
        fontSize: '10px',
      },
    });
    meta.appendChild(language);
  }

  if (repo.stargazers_count > 0) {
    const stars = createElement('span', {
      textContent: `\u2605 ${repo.stargazers_count}`,
      className: 'repo-stars',
    });
    meta.appendChild(stars);
  }

  const updated = createElement('span', {
    textContent: formatRelativeTime(repo.updated_at),
    className: 'repo-updated',
  });
  meta.appendChild(updated);

  item.appendChild(meta);

  return item;
}

/**
 * エラー表示
 */
export function renderRepositoryError(
  container: HTMLElement,
  error: string
): void {
  container.innerHTML = '';
  container.appendChild(createErrorElement(error));
}

