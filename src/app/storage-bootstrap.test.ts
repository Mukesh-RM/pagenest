// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as OpfsModule from '@/data/opfs';
import { getDb } from '@/data/db';
import { openOpfsRoot } from '@/data/opfs';
import { bootstrapStorage } from './storage-bootstrap';
import { storageBootstrap } from './storage-bootstrap-state';

vi.mock('@/data/opfs', async (importOriginal) => {
  const actual = await importOriginal<typeof OpfsModule>();
  return { ...actual, openOpfsRoot: vi.fn() };
});

vi.mock('@/features/library/registry', () => ({
  setImportBackend: vi.fn(),
}));

describe('bootstrapStorage', () => {
  beforeEach(() => {
    vi.mocked(openOpfsRoot).mockReset();
  });

  it('registers shared OPFS and in-process import when OPFS opens', async () => {
    vi.mocked(openOpfsRoot).mockResolvedValue({} as Awaited<ReturnType<typeof openOpfsRoot>>);
    await bootstrapStorage();
    const boot = storageBootstrap();
    expect(boot?.sharedFiles).toBeDefined();
    expect(boot?.sharedFiles.persistent).toBe(true);
    expect(boot?.dataClient.workerFactory?.()).toBeUndefined();
    expect(boot?.dataClient.files).toBe(boot?.sharedFiles);
  });

  it('uses cache-backed storage and in-process import when OPFS is blocked', async () => {
    vi.mocked(openOpfsRoot).mockResolvedValue(undefined);
    await bootstrapStorage();
    const boot = storageBootstrap();
    expect(boot?.sharedFiles).toBeDefined();
    expect(boot?.sharedFiles.persistent).toBe(true);
    expect(boot?.dataClient.workerFactory?.()).toBeUndefined();
    expect(boot?.dataClient.files).toBe(boot?.sharedFiles);
    expect(getDb().name).toBe('pagenest');
  });
});
