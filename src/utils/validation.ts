import {
  Settings,
  LayoutItem,
  RepositoryDisplaySettings,
  DisplayPreferences,
} from '../types/settings';

/**
 * バリデーション結果の型定義
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 設定データのバリデーション
 * @param settings バリデーション対象の設定
 * @returns ValidationResult
 */
export function validateSettings(settings: unknown): ValidationResult {
  const errors: string[] = [];

  if (!settings || typeof settings !== 'object') {
    errors.push('設定データが不正です');
    return { valid: false, errors };
  }

  const s = settings as Partial<Settings>;

  // layoutのバリデーション
  if (!s.layout || !Array.isArray(s.layout)) {
    errors.push('layoutが配列ではありません');
  } else {
    s.layout.forEach((item, index) => {
      const itemErrors = validateLayoutItem(item);
      if (!itemErrors.valid) {
        errors.push(`layout[${index}]: ${itemErrors.errors.join(', ')}`);
      }
    });
  }

  // tokenのバリデーション
  if (s.token !== undefined && typeof s.token !== 'string') {
    errors.push('tokenが文字列ではありません');
  }

  // cacheのバリデーション
  if (s.cache !== undefined && typeof s.cache !== 'object') {
    errors.push('cacheがオブジェクトではありません');
  }

  // preferencesのバリデーション
  if (s.preferences !== undefined) {
    if (!s.preferences || typeof s.preferences !== 'object') {
      errors.push('preferencesがオブジェクトではありません');
    } else {
      const preferencesErrors = validateDisplayPreferences(
        s.preferences as DisplayPreferences
      );
      if (!preferencesErrors.valid) {
        errors.push(...preferencesErrors.errors);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateDisplayPreferences(
  preferences: DisplayPreferences
): ValidationResult {
  const errors: string[] = [];

  if (!preferences || typeof preferences !== 'object') {
    errors.push('preferencesが不正です');
    return { valid: false, errors };
  }

  if (preferences.repositories !== undefined) {
    const repoValidation = validateRepositoryDisplaySettings(
      preferences.repositories
    );
    if (!repoValidation.valid) {
      errors.push(
        ...repoValidation.errors.map((err) => `repositories: ${err}`)
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateRepositoryDisplaySettings(
  settings: RepositoryDisplaySettings
): ValidationResult {
  const errors: string[] = [];

  if (!settings || typeof settings !== 'object') {
    errors.push('repositories設定が不正です');
    return { valid: false, errors };
  }

  if (
    settings.perOrgLimit !== undefined &&
    (typeof settings.perOrgLimit !== 'number' ||
      !Number.isFinite(settings.perOrgLimit) ||
      settings.perOrgLimit < 0)
  ) {
    errors.push('perOrgLimitは0以上の数値である必要があります');
  }

  if (
    settings.updatedWithinDays !== undefined &&
    (typeof settings.updatedWithinDays !== 'number' ||
      !Number.isFinite(settings.updatedWithinDays) ||
      settings.updatedWithinDays < 0)
  ) {
    errors.push('updatedWithinDaysは0以上の数値である必要があります');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * レイアウトアイテムのバリデーション
 * @param item バリデーション対象のレイアウトアイテム
 * @returns ValidationResult
 */
export function validateLayoutItem(item: unknown): ValidationResult {
  const errors: string[] = [];

  if (!item || typeof item !== 'object') {
    errors.push('レイアウトアイテムが不正です');
    return { valid: false, errors };
  }

  const i = item as Partial<LayoutItem>;

  if (!i.id || typeof i.id !== 'string') {
    errors.push('idが不正です');
  }

  if (typeof i.enabled !== 'boolean') {
    errors.push('enabledがbooleanではありません');
  }

  if (typeof i.order !== 'number') {
    errors.push('orderが数値ではありません');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Personal Access Tokenの形式バリデーション
 * @param token バリデーション対象のトークン
 * @returns ValidationResult
 */
export function validateToken(token: string): ValidationResult {
  const errors: string[] = [];

  if (!token || typeof token !== 'string') {
    errors.push('トークンが不正です');
    return { valid: false, errors };
  }

  // GitHubのPATは通常40文字または93文字（fine-grained token）
  if (token.length < 40) {
    errors.push('トークンの長さが短すぎます');
  }

  // 英数字とアンダースコアのみ許可
  if (!/^[a-zA-Z0-9_]+$/.test(token)) {
    errors.push('トークンに不正な文字が含まれています');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * JSONデータのバリデーション
 * @param jsonString バリデーション対象のJSON文字列
 * @returns ValidationResult & { data?: unknown }
 */
export function validateJSON(
  jsonString: string
): ValidationResult & { data?: unknown } {
  const errors: string[] = [];

  if (!jsonString || typeof jsonString !== 'string') {
    errors.push('JSONデータが不正です');
    return { valid: false, errors };
  }

  try {
    const data = JSON.parse(jsonString);
    return { valid: true, errors: [], data };
  } catch (error) {
    errors.push(
      `JSONのパースに失敗しました: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return { valid: false, errors };
  }
}

