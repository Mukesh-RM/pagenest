// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { handleShareRequest, SHARE_INBOX_CACHE, takeSharedFiles } from './share-target';
import { MemoryCacheStorage } from './test-cache';

function shareRequest(files: File[]): Request {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  form.append('title', 'ignored');
  return new Request('https://pagenest.test/share-target', { method: 'POST', body: form });
}

describe('share target', () => {
  it('parks shared files in the inbox and redirects into the app', async () => {
    const storage = new MemoryCacheStorage();
    const response = await handleShareRequest(
      shareRequest([new File(['%PDF'], 'My Book.pdf', { type: 'application/pdf' }), new File(['ID3'], 'a b.mp3', { type: 'audio/mpeg' })]),
      storage.asCacheStorage(),
      () => 42,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('https://pagenest.test/?share=2');
    expect(await storage.has(SHARE_INBOX_CACHE)).toBe(true);
  });

  it('hands the files back with name, type and bytes intact, then empties the inbox', async () => {
    const storage = new MemoryCacheStorage();
    await handleShareRequest(
      shareRequest([new File(['%PDF-1'], 'Ünï code.pdf', { type: 'application/pdf' }), new File(['abc'], 'b.m4b')]),
      storage.asCacheStorage(),
    );
    const files = await takeSharedFiles(storage.asCacheStorage());
    expect(files.map((f) => f.name)).toEqual(['Ünï code.pdf', 'b.m4b']);
    expect(files[0]?.type).toBe('application/pdf');
    expect(files[1]?.type).toBe('application/octet-stream');
    expect(await files[0]?.text()).toBe('%PDF-1');
    expect(await takeSharedFiles(storage.asCacheStorage())).toEqual([]);
    expect(await storage.has(SHARE_INBOX_CACHE)).toBe(false);
  });

  it('keeps the order of ten files', async () => {
    const storage = new MemoryCacheStorage();
    const names = Array.from({ length: 10 }, (_, i) => `book-${i}.epub`);
    await handleShareRequest(shareRequest(names.map((n) => new File(['x'], n))), storage.asCacheStorage());
    expect((await takeSharedFiles(storage.asCacheStorage())).map((f) => f.name)).toEqual(names);
  });

  it('still redirects when nothing usable was shared', async () => {
    const storage = new MemoryCacheStorage();
    const response = await handleShareRequest(new Request('https://pagenest.test/share-target', { method: 'POST', body: 'not a form' }), storage.asCacheStorage());
    expect(response.headers.get('Location')).toBe('https://pagenest.test/?share=0');
    expect(await takeSharedFiles(storage.asCacheStorage())).toEqual([]);
  });

  it('returns no files when there is no Cache API', async () => {
    expect(await takeSharedFiles(undefined)).toEqual([]);
  });
});
