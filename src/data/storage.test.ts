import { formatBytes, getStorageStatus, requestPersistentStorage } from './storage';

const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'navigator', original);
});
const setStorage = (storage: unknown): void =>
  void Object.defineProperty(globalThis, 'navigator', { value: { storage }, configurable: true });

describe('storage status', () => {
  it('reads usage, quota and persistence', async () => {
    setStorage({ estimate: async () => ({ usage: 10, quota: 100 }), persisted: async () => true });
    expect(await getStorageStatus()).toEqual({ usageBytes: 10, quotaBytes: 100, persisted: true });
  });

  it('returns an empty status when the browser says nothing or throws', async () => {
    setStorage({});
    expect(await getStorageStatus()).toEqual({});
    setStorage({
      estimate: async () => {
        throw new Error('x');
      },
    });
    expect(await getStorageStatus()).toEqual({});
  });

  it('requests persistence and handles refusal', async () => {
    setStorage({ persist: async () => true });
    expect(await requestPersistentStorage()).toBe(true);
    setStorage({ persist: async () => false });
    expect(await requestPersistentStorage()).toBe(false);
    setStorage({});
    expect(await requestPersistentStorage()).toBe(false);
  });
});

describe('formatBytes', () => {
  it('formats for people', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(-1)).toBe('0 B');
  });
});
