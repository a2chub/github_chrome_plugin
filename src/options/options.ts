import { Message } from '../types/messages';
import { logger } from '../utils/logger';
import {
  Settings,
  DEFAULT_SETTINGS,
  RepositoryDisplaySettings,
} from '../types/settings';
import { normalizeSettings } from '../utils/storage';

/**
 * Options Page Script
 * 設定画面のUI操作を担当
 */

logger.info('Options page loaded');

let currentSettings: Settings | null = null;

/**
 * 初期化処理
 */
async function init() {
  logger.info('Initializing options page...');

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
      currentSettings = normalizeSettings(response.data);
      logger.info('Settings loaded:', currentSettings);
    } else {
      logger.error('Failed to load settings:', response.error);
      showStatus('token-status', 'error', '設定の読み込みに失敗しました');
    }
  } catch (error) {
    logger.error('Error loading settings:', error);
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

  const repoSettings = getRepositorySettings();
  const perOrgInput = document.getElementById(
    'repo-per-org-limit'
  ) as HTMLInputElement | null;
  if (perOrgInput) {
    perOrgInput.value = String(repoSettings.perOrgLimit);
  }

  const updatedWithinInput = document.getElementById(
    'repo-updated-within'
  ) as HTMLInputElement | null;
  if (updatedWithinInput) {
    updatedWithinInput.value = String(repoSettings.updatedWithinDays);
  }
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

  // リポジトリ表示設定
  const perOrgInput = document.getElementById(
    'repo-per-org-limit'
  ) as HTMLInputElement | null;
  if (perOrgInput) {
    perOrgInput.addEventListener('change', handleRepositoryLimitChange);
  }

  const updatedWithinInput = document.getElementById(
    'repo-updated-within'
  ) as HTMLInputElement | null;
  if (updatedWithinInput) {
    updatedWithinInput.addEventListener('change', handleRepositoryDaysChange);
  }

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
    logger.error('Error saving token:', error);
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
    logger.error('Error validating token:', error);
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
      logger.info('Layout settings saved');
    } else {
      logger.error('Failed to save layout settings:', response.error);
    }
  } catch (error) {
    logger.error('Error saving layout settings:', error);
  }
}

/**
 * Organizationごとのリポジトリ表示数変更ハンドラー
 */
async function handleRepositoryLimitChange(event: Event) {
  if (!currentSettings) {
    return;
  }

  const input = event.target as HTMLInputElement;
  const repoSettings = getRepositorySettings();
  const previousValue = repoSettings.perOrgLimit;
  const value = Number.parseInt(input.value, 10);

  if (Number.isNaN(value) || value < 0 || value > 50) {
    showStatus(
      'repository-status',
      'error',
      '0〜50の範囲で数値を入力してください'
    );
    input.value = String(previousValue);
    return;
  }

  repoSettings.perOrgLimit = value;
  currentSettings.preferences.repositories = repoSettings;

  await persistCurrentSettings(
    'repository-status',
    'リポジトリ表示設定を保存しました'
  );
}

/**
 * リポジトリの最終更新日範囲変更ハンドラー
 */
async function handleRepositoryDaysChange(event: Event) {
  if (!currentSettings) {
    return;
  }

  const input = event.target as HTMLInputElement;
  const repoSettings = getRepositorySettings();
  const previousValue = repoSettings.updatedWithinDays;
  const value = Number.parseInt(input.value, 10);

  if (Number.isNaN(value) || value < 0 || value > 365) {
    showStatus(
      'repository-status',
      'error',
      '0〜365の範囲で数値を入力してください'
    );
    input.value = String(previousValue);
    return;
  }

  repoSettings.updatedWithinDays = value;
  currentSettings.preferences.repositories = repoSettings;

  await persistCurrentSettings(
    'repository-status',
    'リポジトリ表示設定を保存しました'
  );
}

/**
 * 現在の設定を保存
 */
async function persistCurrentSettings(
  statusElementId: string,
  successMessage: string
) {
  if (!currentSettings) {
    return;
  }

  try {
    showStatus(statusElementId, 'info', '保存中...');

    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: currentSettings,
    } as Message);

    if (response.success) {
      showStatus(statusElementId, 'success', successMessage);
    } else {
      const errorMessage =
        typeof response.error === 'string'
          ? response.error
          : '保存に失敗しました';
      showStatus(
        statusElementId,
        'error',
        `保存に失敗しました: ${errorMessage}`
      );
    }
  } catch (error) {
    logger.error('Error saving settings:', error);
    showStatus(statusElementId, 'error', '保存に失敗しました');
  }
}

/**
 * リポジトリ表示設定を取得
 */
function getRepositorySettings(): RepositoryDisplaySettings {
  if (!currentSettings) {
    return { ...DEFAULT_SETTINGS.preferences.repositories };
  }

  if (!currentSettings.preferences) {
    currentSettings.preferences = {
      repositories: { ...DEFAULT_SETTINGS.preferences.repositories },
    };
  }

  if (!currentSettings.preferences.repositories) {
    currentSettings.preferences.repositories = {
      ...DEFAULT_SETTINGS.preferences.repositories,
    };
  }

  return currentSettings.preferences.repositories;
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
    logger.error('Export error:', error);
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
    logger.error('Import error:', error);
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

