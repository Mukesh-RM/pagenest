import { describe, expect, it, vi } from 'vitest';
import { requestPersistence } from './persist';

describe('requestPersistence', () => {
  it('reports unsupported when the browser has no storage manager', async () => {
    expect(await requestPersistence(undefined)).toEqual({ supported: false, persisted: false });
    expect(await requestPersistence({ estimate: async () => ({}) })).toEqual({ supported: false, persisted: false });
  });
  it('does not ask again when already persisted, and reports usage', async () => {
    const persist = vi.fn(async () => true);
    const result = await requestPersistence({
      persisted: async () => true,
      persist,
      estimate: async () => ({ usage: 10, quota: 100 }),
    });
    expect(persist).not.toHaveBeenCalled();
    expect(result).toEqual({ supported: true, persisted: true, usageBytes: 10, quotaBytes: 100 });
  });
  it('asks once when not yet persisted and returns the answer', async () => {
    const persist = vi.fn(async () => true);
    const result = await requestPersistence({ persisted: async () => false, persist });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ supported: true, persisted: true });
  });
  it('reports a refusal', async () => {
    const result = await requestPersistence({ persisted: async () => false, persist: async () => false });
    expect(result.persisted).toBe(false);
  });
  it('never throws when the browser throws', async () => {
    const result = await requestPersistence({
      persisted: async () => {
        throw new Error('blocked');
      },
      persist: async () => true,
      estimate: async () => {
        throw new Error('blocked');
      },
    });
    expect(result).toEqual({ supported: true, persisted: false });
  });
});
