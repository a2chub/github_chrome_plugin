import { Message } from '../types/messages';
import { Settings } from '../types/settings';

/**
 * Options Page Script
 * 設定画面のUI操作を担当
 */

console.log('Options page loaded');

let currentSettings: Settings | null = null;

/**
 * 初期化処理
 */
async function init() {
  console.log('Initializing options page...');

  // 設定を読み込む
  await loadSettings();

  // イベントリスナーを設定
  setupEventListeners();

  // UIを更新
  updateUI();
}

/**
 * 設定を読み込む
 */
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SETTINGS',
    } as Message);

    if (response.success) {
      currentSettings = response.data;
      console.log('Settings loaded:', currentSettings);
    } else {
      console.error('Failed to load settings:', response.error);
      showStatus('token-status', 'error', '設定の読み込みに失敗しました');
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('token-status', 'error', '設定の読み込みに失敗しました');
  }
}

/**
 * UIを更新
 */
function updateUI() {
  if (!currentSettings) {
    return;
  }

  // トークン入力フィールド
  const tokenInput = document.getElementById('token') as HTMLInputElement;
  if (tokenInput && currentSettings.token) {
    tokenInput.value = currentSettings.token;
  }

  // レイアウト設定チェックボックス
  currentSettings.layout.forEach((item) => {
    const checkbox = document.getElementById(
      `layout-${item.id}`
    ) as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = item.enabled;
    }
  });
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // トークンの表示/非表示切り替え
  const toggleTokenBtn = document.getElementById('toggle-token-visibility');
  const tokenInput = document.getElementById('token') as HTMLInputElement;
  if (toggleTokenBtn && tokenInput) {
    toggleTokenBtn.addEventListener('click', () => {
      if (tokenInput.type === 'password') {
        tokenInput.type = 'text';
        toggleTokenBtn.textContent = '非表示';
      } else {
        tokenInput.type = 'password';
        toggleTokenBtn.textContent = '表示';
      }
    });
  }

  // トークン保存ボタン
  const saveTokenBtn = document.getElementById('save-token');
  if (saveTokenBtn) {
    saveTokenBtn.addEventListener('click', handleSaveToken);
  }

  // トークン検証ボタン
  const validateTokenBtn = document.getElementById('validate-token');
  if (validateTokenBtn) {
    validateTokenBtn.addEventListener('click', handleValidateToken);
  }

  // レイアウト設定チェックボックス
  const layoutCheckboxes = document.querySelectorAll(
    '.layout-item input[type="checkbox"]'
  );
  layoutCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', handleLayoutChange);
  });

  // Export/Importボタン
  const exportBtn = document.getElementById('export-settings');
  const importBtn = document.getElementById('import-settings');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }
  if (importBtn) {
    importBtn.addEventListener('click', handleImport);
  }

  // ファイル選択input
  const fileInput = document.getElementById('import-file') as HTMLInputElement;
  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }
}

/**
 * トークン保存ハンドラー
 */
async function handleSaveToken() {
  const tokenInput = document.getElementById('token') as HTMLInputElement;
  if (!tokenInput) {
    return;
  }

  const token = tokenInput.value.trim();
  if (!token) {
    showStatus('token-status', 'error', 'トークンを入力してください');
    return;
  }

  try {
    showStatus('token-status', 'info', '保存中...');

    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_TOKEN',
      token,
    } as Message);

    if (response.success) {
      showStatus('token-status', 'success', 'トークンを保存しました');
      // 設定を再読み込み
      await loadSettings();
    } else {
      showStatus(
        'token-status',
        'error',
        `保存に失敗しました: ${response.error}`
      );
    }
  } catch (error) {
    console.error('Error saving token:', error);
    showStatus('token-status', 'error', '保存に失敗しました');
  }
}

/**
 * トークン検証ハンドラー（Phase 3で実装）
 */
async function handleValidateToken() {
  try {
    showStatus('token-status', 'info', '検証中...');

    const response = await chrome.runtime.sendMessage({
      type: 'VALIDATE_TOKEN',
    } as Message);

    if (response.data?.valid) {
      showStatus('token-status', 'success', 'トークンは有効です');
    } else {
      showStatus(
        'token-status',
        'error',
        response.data?.message || 'トークンが無効です'
      );
    }
  } catch (error) {
    console.error('Error validating token:', error);
    showStatus('token-status', 'error', '検証に失敗しました');
  }
}

/**
 * レイアウト変更ハンドラー
 */
async function handleLayoutChange(event: Event) {
  const checkbox = event.target as HTMLInputElement;
  const layoutId = checkbox.id.replace('layout-', '');
  const enabled = checkbox.checked;

  if (!currentSettings) {
    return;
  }

  // 設定を更新
  const layoutItem = currentSettings.layout.find((item) => item.id === layoutId);
  if (layoutItem) {
    layoutItem.enabled = enabled;
  }

  // 設定を保存
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: currentSettings,
    } as Message);

    if (response.success) {
      console.log('Layout settings saved');
    } else {
      console.error('Failed to save layout settings:', response.error);
    }
  } catch (error) {
    console.error('Error saving layout settings:', error);
  }
}

/**
 * Export処理
 */
async function handleExport() {
  try {
    if (!currentSettings) {
      showStatus('export-status', 'error', '設定が読み込まれていません');
      return;
    }

    showStatus('export-status', 'info', 'エクスポート中...');

    // 設定をJSON文字列に変換
    const jsonString = JSON.stringify(currentSettings, null, 2);

    // Blobを作成
    const blob = new Blob([jsonString], { type: 'application/json' });

    // ダウンロードリンクを作成
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // ファイル名を生成（タイムスタンプ付き）
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .split('.')[0];
    a.download = `github-dashboard-settings-${timestamp}.json`;

    // ダウンロードを実行
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // URLを解放
    URL.revokeObjectURL(url);

    showStatus('export-status', 'success', '設定をエクスポートしました');
  } catch (error) {
    console.error('Export error:', error);
    showStatus('export-status', 'error', 'エクスポートに失敗しました');
  }
}

/**
 * Import処理
 */
function handleImport() {
  const fileInput = document.getElementById('import-file') as HTMLInputElement;
  if (!fileInput) {
    return;
  }

  // ファイル選択ダイアログを開く
  fileInput.click();
}

/**
 * ファイル選択時の処理
 */
async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  try {
    showStatus('export-status', 'info', 'インポート中...');

    // ファイルを読み込む
    const text = await readFileAsText(file);

    // JSONをパース
    const data = JSON.parse(text);

    // 設定データのバリデーション
    const { validateSettings } = await import('../utils/validation');
    const validation = validateSettings(data);

    if (!validation.valid) {
      showStatus(
        'export-status',
        'error',
        `不正な設定データです: ${validation.errors.join(', ')}`
      );
      return;
    }

    // 設定を保存
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: data,
    } as Message);

    if (response.success) {
      showStatus('export-status', 'success', '設定をインポートしました');

      // 設定を再読み込み
      await loadSettings();

      // UIを更新
      updateUI();
    } else {
      showStatus(
        'export-status',
        'error',
        `インポートに失敗しました: ${response.error}`
      );
    }
  } catch (error) {
    console.error('Import error:', error);
    if (error instanceof SyntaxError) {
      showStatus('export-status', 'error', 'JSONの形式が不正です');
    } else {
      showStatus('export-status', 'error', 'インポートに失敗しました');
    }
  } finally {
    // ファイル選択をリセット
    input.value = '';
  }
}

/**
 * ファイルをテキストとして読み込む
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      resolve(text);
    };

    reader.onerror = () => {
      reject(new Error('ファイルの読み込みに失敗しました'));
    };

    reader.readAsText(file);
  });
}

/**
 * ステータスメッセージを表示
 */
function showStatus(
  elementId: string,
  type: 'success' | 'error' | 'info',
  message: string
) {
  const statusElement = document.getElementById(elementId);
  if (!statusElement) {
    return;
  }

  statusElement.className = `status-message ${type}`;
  statusElement.textContent = message;

  // 3秒後に非表示（errorの場合は5秒）
  const timeout = type === 'error' ? 5000 : 3000;
  setTimeout(() => {
    statusElement.className = 'status-message';
    statusElement.textContent = '';
  }, timeout);
}

// 初期化実行
init();

