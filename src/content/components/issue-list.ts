import { Issue, Label } from '../../types/api';
import {
  createElement,
  createEmptyState,
  createErrorElement,
  formatRelativeTime,
} from '../dom-manipulator';
import { getData, saveData } from '../../utils/storage';

interface IssueFilterState {
  selectedRepos: string[];
  collapsed: boolean;
}

interface NormalizedIssue {
  issue: Issue;
  repository: string;
}

const ISSUE_FILTER_STORAGE_KEY = 'issueFilterState';
const UNKNOWN_REPOSITORY = 'リポジトリ不明';

let issueFilterState: IssueFilterState = {
  selectedRepos: [],
  collapsed: false,
};
let isIssueFilterStateLoaded = false;

async function ensureIssueFilterState(): Promise<IssueFilterState> {
  if (!isIssueFilterStateLoaded) {
    const storedState =
      (await getData<IssueFilterState>(ISSUE_FILTER_STORAGE_KEY)) || null;

    if (storedState) {
      issueFilterState = {
        selectedRepos: Array.isArray(storedState.selectedRepos)
          ? storedState.selectedRepos
          : [],
        collapsed: Boolean(storedState.collapsed),
      };
    }

    isIssueFilterStateLoaded = true;
  }

  return issueFilterState;
}

async function persistIssueFilterState(): Promise<void> {
  try {
    await saveData(ISSUE_FILTER_STORAGE_KEY, issueFilterState);
  } catch (error) {
    console.error('Failed to persist issue filter state:', error);
  }
}

/**
 * Issueリストを描画
 * @param container 描画先のコンテナ要素
 * @param issues Issue配列
 */
export async function renderIssueList(
  container: HTMLElement,
  issues: Issue[]
): Promise<void> {
  container.innerHTML = '';

  const openIssues = (issues || []).filter((issue) => issue.state === 'open');

  if (openIssues.length === 0) {
    container.appendChild(
      createEmptyState('オープン状態のメンションされたIssueが見つかりませんでした')
    );
    return;
  }

  const normalizedIssues: NormalizedIssue[] = openIssues.map((issue) => ({
    issue,
    repository: getRepositoryName(issue) ?? UNKNOWN_REPOSITORY,
  }));

  const repositoryNames = Array.from(
    new Set(normalizedIssues.map((item) => item.repository))
  ).sort((a, b) => a.localeCompare(b));

  const state = await ensureIssueFilterState();

  let selection = new Set(
    state.selectedRepos.filter((repo) => repositoryNames.includes(repo))
  );

  if (selection.size === 0) {
    selection = new Set(repositoryNames);
  }

  issueFilterState.selectedRepos = Array.from(selection);
  let isCollapsed = state.collapsed ?? false;

  const wrapper = createElement('div', {
    styles: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
  });

  const filterPanel = createElement('div', {
    styles: {
      border: '1px solid #d0d7de',
      borderRadius: '6px',
      padding: '12px 14px',
      backgroundColor: '#f6f8fa',
      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
    },
  });

  const headerButton = createElement('button', {
    attributes: {
      type: 'button',
      'aria-expanded': isCollapsed ? 'false' : 'true',
    },
    styles: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '100%',
      backgroundColor: 'transparent',
      border: 'none',
      padding: '0',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      color: '#24292f',
    },
  });

  const toggleIcon = createElement('span', {
    textContent: isCollapsed ? '\u25B8' : '\u25BE',
    styles: {
      fontSize: '12px',
      color: '#57606a',
    },
  });

  const title = createElement('span', {
    textContent: 'リポジトリフィルター',
  });

  const selectedSummary = createElement('span', {
    styles: {
      marginLeft: 'auto',
      fontSize: '12px',
      color: '#57606a',
    },
  });

  headerButton.appendChild(toggleIcon);
  headerButton.appendChild(title);
  headerButton.appendChild(selectedSummary);
  filterPanel.appendChild(headerButton);

  const filterContent = createElement('div', {
    styles: {
      display: isCollapsed ? 'none' : 'flex',
      flexDirection: 'column',
      gap: '8px',
      marginTop: '12px',
    },
  });

  const actions = createElement('div', {
    styles: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
    },
  });

  const actionButtonStyles: Partial<CSSStyleDeclaration> = {
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid #d0d7de',
    backgroundColor: '#ffffff',
    fontSize: '12px',
    cursor: 'pointer',
  };

  const selectAllButton = createElement('button', {
    textContent: '全リポジトリ',
    attributes: {
      type: 'button',
    },
    styles: actionButtonStyles,
  });

  const clearButton = createElement('button', {
    textContent: 'リポジトリクリア',
    attributes: {
      type: 'button',
    },
    styles: actionButtonStyles,
  });

  actions.appendChild(selectAllButton);
  actions.appendChild(clearButton);

  const checkboxList = createElement('div', {
    styles: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      maxHeight: '240px',
      overflowY: 'auto',
      paddingRight: '4px',
    },
  });

  const checkboxMap = new Map<string, HTMLInputElement>();

  repositoryNames.forEach((name, index) => {
    const checkboxRow = createElement('label', {
      styles: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        color: '#24292f',
        cursor: 'pointer',
      },
    });

    const checkbox = createElement('input', {
      attributes: {
        type: 'checkbox',
        id: `issue-filter-${index}`,
      },
      styles: {
        width: '14px',
        height: '14px',
        cursor: 'pointer',
      },
    }) as HTMLInputElement;

    checkbox.checked = selection.has(name);

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selection.add(name);
      } else {
        selection.delete(name);
      }
      applySelectionChange();
    });

    const labelText = createElement('span', {
      textContent: name,
      styles: {
        flex: '1',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
    });

    checkboxRow.appendChild(checkbox);
    checkboxRow.appendChild(labelText);
    checkboxList.appendChild(checkboxRow);
    checkboxMap.set(name, checkbox);
  });

  filterContent.appendChild(actions);
  filterContent.appendChild(checkboxList);
  filterPanel.appendChild(filterContent);
  wrapper.appendChild(filterPanel);

  const listContainer = createElement('div', {
    styles: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
  });
  wrapper.appendChild(listContainer);
  container.appendChild(wrapper);

  function updateSelectionSummary(): void {
    if (selection.size === 0) {
      selectedSummary.textContent = 'リポジトリ未選択';
      selectedSummary.style.color = '#cf222e';
    } else if (selection.size === repositoryNames.length) {
      selectedSummary.textContent = '全リポジトリを表示中';
      selectedSummary.style.color = '#57606a';
    } else {
      selectedSummary.textContent = `${selection.size}/${repositoryNames.length} リポジトリ`;
      selectedSummary.style.color = '#57606a';
    }
  }

  function updateCheckboxStates(): void {
    checkboxMap.forEach((checkbox, name) => {
      checkbox.checked = selection.has(name);
    });
  }

  function updateIssues(): void {
    renderIssueItems(listContainer, normalizedIssues, selection);
  }

  function applySelectionChange(): void {
    issueFilterState.selectedRepos = Array.from(selection);
    updateCheckboxStates();
    updateSelectionSummary();
    void persistIssueFilterState();
    updateIssues();
  }

  function updateCollapseState(): void {
    filterContent.style.display = isCollapsed ? 'none' : 'flex';
    toggleIcon.textContent = isCollapsed ? '\u25B8' : '\u25BE';
    headerButton.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    issueFilterState.collapsed = isCollapsed;
    void persistIssueFilterState();
  }

  selectAllButton.addEventListener('click', (event) => {
    event.preventDefault();
    selection = new Set(repositoryNames);
    applySelectionChange();
  });

  clearButton.addEventListener('click', (event) => {
    event.preventDefault();
    selection = new Set();
    applySelectionChange();
  });

  headerButton.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    updateCollapseState();
  });

  applySelectionChange();
  updateCollapseState();
}

function renderIssueItems(
  container: HTMLElement,
  normalizedIssues: NormalizedIssue[],
  selection: Set<string>
): void {
  container.innerHTML = '';

  if (selection.size === 0) {
    container.appendChild(
      createEmptyState('表示するリポジトリを選択してください。')
    );
    return;
  }

  const filtered = normalizedIssues.filter((item) =>
    selection.has(item.repository)
  );

  if (filtered.length === 0) {
    container.appendChild(
      createEmptyState('選択したリポジトリのIssueは見つかりませんでした')
    );
    return;
  }

  const list = createElement('div', {
    className: 'issue-list',
    styles: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
  });

  filtered.slice(0, 20).forEach(({ issue, repository }) => {
    const issueItem = createIssueItem(issue, repository);
    list.appendChild(issueItem);
  });

  container.appendChild(list);
}

/**
 * Issueアイテムを作成
 */
function createIssueItem(
  issue: Issue,
  repositoryName?: string
): HTMLElement {
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
  const repoName = repositoryName ?? getRepositoryName(issue);
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

