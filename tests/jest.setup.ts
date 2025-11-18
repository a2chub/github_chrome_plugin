import { chromeStorageMock } from './helpers/chrome-storage-mock';

const globalWithChrome = globalThis as typeof globalThis & {
  chrome?: typeof chrome;
};

globalWithChrome.chrome = {
  storage: chromeStorageMock,
} as unknown as typeof chrome;

