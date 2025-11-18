type StorageKey = string | string[] | Record<string, unknown> | null;

const storageMap = new Map<string, unknown>();

const buildResult = (keys: StorageKey): Record<string, unknown> => {
  if (keys === null) {
    return Object.fromEntries(storageMap.entries());
  }

  if (Array.isArray(keys)) {
    const result: Record<string, unknown> = {};
    keys.forEach((key) => {
      result[key] = storageMap.get(key);
    });
    return result;
  }

  if (typeof keys === 'string') {
    return { [keys]: storageMap.get(keys) };
  }

  if (typeof keys === 'object' && keys !== null) {
    const result: Record<string, unknown> = {};
    Object.keys(keys).forEach((key) => {
      result[key] = storageMap.get(key) ?? (keys as Record<string, unknown>)[key];
    });
    return result;
  }

  return {};
};

export const chromeStorageMock = {
  local: {
    get: jest.fn(async (keys: StorageKey) => {
      return buildResult(keys);
    }),
    set: jest.fn(async (items: Record<string, unknown>) => {
      Object.entries(items).forEach(([key, value]) => {
        storageMap.set(key, value);
      });
    }),
    remove: jest.fn(async (keys: string | string[]) => {
      if (Array.isArray(keys)) {
        keys.forEach((key) => storageMap.delete(key));
      } else {
        storageMap.delete(keys);
      }
    }),
    clear: jest.fn(async () => {
      storageMap.clear();
    }),
  },
};

export function resetChromeStorageMock(): void {
  storageMap.clear();
  chromeStorageMock.local.get.mockClear();
  chromeStorageMock.local.set.mockClear();
  chromeStorageMock.local.remove.mockClear();
  chromeStorageMock.local.clear.mockClear();
}

