/**
 * DOM操作ユーティリティ
 * GitHubダッシュボードのDOMを操作する機能を提供
 */
import { logger } from './logger';

/**
 * セレクタで要素を検索して削除
 * @param selector CSSセレクタ
 */
export function removeElements(selector: string): void {
  const elements = document.querySelectorAll(selector);
  elements.forEach((element) => {
    element.remove();
  });
  logger.debug(`Removed ${elements.length} elements matching "${selector}"`);
}

/**
 * セレクタで要素を検索して非表示
 * @param selector CSSセレクタ
 */
export function hideElements(selector: string): void {
  const elements = document.querySelectorAll(selector);
  elements.forEach((element) => {
    element.classList.add('gdc-hidden');
  });
  logger.debug(`Hidden ${elements.length} elements matching "${selector}"`);
}

/**
 * セレクタで要素を検索して表示を復元
 * @param selector CSSセレクタ
 */
export function showElements(selector: string): void {
  const elements = document.querySelectorAll(selector);
  elements.forEach((element) => {
    element.classList.remove('gdc-hidden');
  });
  logger.debug(`Shown ${elements.length} elements matching "${selector}"`);
}

/**
 * 要素を作成
 * @param tag タグ名
 * @param options オプション
 * @returns 作成されたHTML要素
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    id?: string;
    textContent?: string;
    innerHTML?: string;
    attributes?: Record<string, string>;
    styles?: Partial<CSSStyleDeclaration>;
  } = {}
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (options.className) {
    element.className = options.className;
  }

  if (options.id) {
    element.id = options.id;
  }

  if (options.textContent) {
    element.textContent = options.textContent;
  }

  if (options.innerHTML) {
    element.innerHTML = options.innerHTML;
  }

  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }

  if (options.styles) {
    Object.assign(element.style, options.styles);
  }

  return element;
}

/**
 * コンテナ要素を作成
 * @param id コンテナID
 * @returns 作成されたコンテナ要素
 */
export function createContainer(id: string): HTMLDivElement {
  return createElement('div', {
    id,
    className: 'github-dashboard-customizer-container',
  });
}

/**
 * スピナー要素を作成
 * @param size スピナーサイズ(px)
 * @returns スピナー要素
 */
export function createSpinnerIcon(size = 18): HTMLSpanElement {
  return createElement('span', {
    className: 'gdc-spinner-icon',
    attributes: {
      'aria-hidden': 'true',
    },
    styles: size !== 18 ? {
      width: `${size}px`,
      height: `${size}px`,
    } : undefined,
  });
}

/**
 * セクション要素を作成
 * @param title セクションタイトル
 * @param id セクションID
 * @returns 作成されたセクション要素
 */
export function createSection(
  title: string,
  id: string
): { section: HTMLElement; content: HTMLDivElement } {
  const section = createElement('section', {
    id,
    className: 'dashboard-section',
  });

  const header = createElement('h2', {
    textContent: title,
    className: 'section-header',
  });

  const content = createElement('div', {
    className: 'section-content',
  });

  section.appendChild(header);
  section.appendChild(content);

  return { section, content };
}

/**
 * ローディング表示を作成
 * @returns ローディング要素
 */
export function createLoadingElement(): HTMLDivElement {
  const loading = createElement('div', {
    className: 'loading gdc-section-loading',
  });

  const content = createElement('div', {
    className: 'gdc-loading-inline',
  });

  const spinner = createSpinnerIcon(20);
  const label = createElement('span', {
    textContent: 'GitHubからデータを取得しています…',
  });

  content.appendChild(spinner);
  content.appendChild(label);
  loading.appendChild(content);
  return loading;
}

/**
 * 空状態の表示を作成
 * @param message メッセージ
 * @returns 空状態要素
 */
export function createEmptyState(message: string): HTMLDivElement {
  return createElement('div', {
    className: 'empty-state',
    textContent: message,
  });
}

/**
 * エラー表示を作成
 * @param message エラーメッセージ
 * @returns エラー要素
 */
export function createErrorElement(message: string): HTMLDivElement {
  return createElement('div', {
    className: 'error-message',
    textContent: message,
  });
}

/**
 * 指定された親要素にコンテンツを挿入
 * @param parent 親要素
 * @param content 挿入するコンテンツ
 */
export function appendContent(
  parent: HTMLElement,
  content: HTMLElement | HTMLElement[]
): void {
  if (Array.isArray(content)) {
    content.forEach((element) => parent.appendChild(element));
  } else {
    parent.appendChild(content);
  }
}

/**
 * DocumentFragmentを使用して一括DOM操作
 * @param elements 追加する要素の配列
 * @returns DocumentFragment
 */
export function createFragment(elements: HTMLElement[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  elements.forEach((element) => fragment.appendChild(element));
  return fragment;
}

/**
 * 相対時間を表示する文字列を生成
 * @param dateString 日付文字列
 * @returns 相対時間の文字列
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) {
    return 'たった今';
  } else if (diffMin < 60) {
    return `${diffMin}分前`;
  } else if (diffHour < 24) {
    return `${diffHour}時間前`;
  } else if (diffDay < 30) {
    return `${diffDay}日前`;
  } else if (diffMonth < 12) {
    return `${diffMonth}ヶ月前`;
  } else {
    return `${diffYear}年前`;
  }
}

/**
 * 通知バナーを作成
 * @param options バナーオプション
 * @returns バナー要素
 */
export function createNotificationBanner(options: {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
}): HTMLDivElement {
  const banner = createElement('div', {
    className: `notification-banner notification-${options.type}`,
  });

  // タイプ別のスタイル設定

  // アイコン
  const icon = createElement('div', {
    className: 'banner-icon',
    textContent: options.type === 'info' ? 'ℹ️' :
      options.type === 'warning' ? '⚠️' :
        options.type === 'error' ? '❌' : '✅',
  });
  banner.appendChild(icon);

  // コンテンツ
  const content = createElement('div', {
    className: 'banner-content',
  });

  const title = createElement('div', {
    textContent: options.title,
    className: 'banner-title',
  });
  content.appendChild(title);

  const message = createElement('div', {
    textContent: options.message,
    className: 'banner-message',
  });
  content.appendChild(message);

  banner.appendChild(content);

  // アクションボタン
  if (options.actionText && options.onAction) {
    const button = createElement('button', {
      textContent: options.actionText,
      className: 'banner-action',
    });

    // タイプ別のボタンスタイル

    button.addEventListener('click', options.onAction);

    banner.appendChild(button);
  }

  return banner;
}

