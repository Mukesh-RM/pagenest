import { afterEach, describe, expect, it } from 'vitest';
import { clearChunkReloadGuard, importModule, isChunkLoadError } from './chunk-import';

describe('isChunkLoadError', () => {
  it('recognises module import failures', () => {
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('network down'))).toBe(false);
  });
});

describe('importModule', () => {
  afterEach(() => {
    clearChunkReloadGuard();
  });

  it('returns on first success', async () => {
    await expect(importModule(async () => 42)).resolves.toBe(42);
  });

  it('retries once on chunk errors', async () => {
    let calls = 0;
    await expect(
      importModule(async () => {
        calls++;
        if (calls === 1) throw new Error('Importing a module script failed.');
        return 'ok';
      }),
    ).resolves.toBe('ok');
    expect(calls).toBe(2);
  });
});
