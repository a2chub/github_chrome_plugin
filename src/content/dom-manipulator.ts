/**
 * DOM操作ユーティリティ
 * GitHubダッシュボードのDOMを操作する機能を提供
 */

/**
 * セレクタで要素を検索して削除
 * @param selector CSSセレクタ
 */
export function removeElements(selector: string): void {
  const elements = document.querySelectorAll(selector);
  elements.forEach((element) => {
    element.remove();
  });
  console.log(`Removed ${elements.length} elements matching "${selector}"`);
}

/**
 * セレクタで要素を検索して非表示
 * @param selector CSSセレクタ
 */
export function hideElements(selector: string): void {
  const elements = document.querySelectorAll(selector);
  elements.forEach((element) => {
    (element as HTMLElement).style.display = 'none';
  });
  console.log(`Hidden ${elements.length} elements matching "${selector}"`);
}

/**
 * セレクタで要素を検索して表示を復元
 * @param selector CSSセレクタ
 */
export function showElements(selector: string): void {
  const elements = document.querySelectorAll(selector);
  elements.forEach((element) => {
    (element as HTMLElement).style.removeProperty('display');
  });
  console.log(`Shown ${elements.length} elements matching "${selector}"`);
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
    styles: {
      position: 'relative',
      width: '100%',
      maxWidth: '1280px',
      margin: '0 auto',
      padding: '24px',
    },
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
    styles: {
      width: `${size}px`,
      height: `${size}px`,
    },
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
    styles: {
      marginBottom: '24px',
      padding: '16px',
      backgroundColor: '#ffffff',
      border: '1px solid #d0d7de',
      borderRadius: '6px',
    },
  });

  const header = createElement('h2', {
    textContent: title,
    className: 'section-header',
    styles: {
      fontSize: '20px',
      fontWeight: '600',
      marginBottom: '16px',
      color: '#24292f',
    },
  });

  const content = createElement('div', {
    className: 'section-content',
    styles: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
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
    styles: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px',
      color: '#57606a',
    },
  });

  const content = createElement('div', {
    className: 'gdc-loading-inline',
    styles: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '14px',
    },
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
    styles: {
      padding: '24px',
      textAlign: 'center',
      color: '#57606a',
      fontSize: '14px',
    },
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
    styles: {
      padding: '12px 16px',
      backgroundColor: '#ffdce0',
      color: '#cf222e',
      border: '1px solid #ffb3b8',
      borderRadius: '6px',
      fontSize: '14px',
    },
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
    styles: {
      position: 'relative',
      padding: '16px 20px',
      marginBottom: '20px',
      borderRadius: '6px',
      border: '1px solid',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
  });

  // タイプ別のスタイル設定
  switch (options.type) {
    case 'info':
      banner.style.backgroundColor = '#ddf4ff';
      banner.style.borderColor = '#54aeff';
      banner.style.color = '#0969da';
      break;
    case 'warning':
      banner.style.backgroundColor = '#fff8c5';
      banner.style.borderColor = '#d4a72c';
      banner.style.color = '#8a6116';
      break;
    case 'error':
      banner.style.backgroundColor = '#ffdce0';
      banner.style.borderColor = '#ffb3b8';
      banner.style.color = '#cf222e';
      break;
    case 'success':
      banner.style.backgroundColor = '#ddf4e4';
      banner.style.borderColor = '#a8ddb5';
      banner.style.color = '#116329';
      break;
  }

  // アイコン
  const icon = createElement('div', {
    className: 'banner-icon',
    textContent: options.type === 'info' ? 'ℹ️' : 
                 options.type === 'warning' ? '⚠️' : 
                 options.type === 'error' ? '❌' : '✅',
    styles: {
      fontSize: '20px',
      flexShrink: '0',
    },
  });
  banner.appendChild(icon);

  // コンテンツ
  const content = createElement('div', {
    className: 'banner-content',
    styles: {
      flex: '1',
      minWidth: '0',
    },
  });

  const title = createElement('div', {
    textContent: options.title,
    className: 'banner-title',
    styles: {
      fontSize: '14px',
      fontWeight: '600',
      marginBottom: '4px',
    },
  });
  content.appendChild(title);

  const message = createElement('div', {
    textContent: options.message,
    className: 'banner-message',
    styles: {
      fontSize: '13px',
    },
  });
  content.appendChild(message);

  banner.appendChild(content);

  // アクションボタン
  if (options.actionText && options.onAction) {
    const button = createElement('button', {
      textContent: options.actionText,
      className: 'banner-action',
      styles: {
        padding: '6px 12px',
        fontSize: '13px',
        fontWeight: '500',
        borderRadius: '6px',
        border: '1px solid',
        backgroundColor: '#ffffff',
        cursor: 'pointer',
        flexShrink: '0',
      },
    });

    // タイプ別のボタンスタイル
    switch (options.type) {
      case 'info':
        button.style.borderColor = '#0969da';
        button.style.color = '#0969da';
        break;
      case 'warning':
        button.style.borderColor = '#8a6116';
        button.style.color = '#8a6116';
        break;
      case 'error':
        button.style.borderColor = '#cf222e';
        button.style.color = '#cf222e';
        break;
      case 'success':
        button.style.borderColor = '#116329';
        button.style.color = '#116329';
        break;
    }

    button.addEventListener('click', options.onAction);
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#f6f8fa';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#ffffff';
    });

    banner.appendChild(button);
  }

  return banner;
}

