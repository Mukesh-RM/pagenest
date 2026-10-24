import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeServices } from '@/app/test-utils';
import type { AppServices } from '@/app/services-context';
import { createSampleBookProvider, SAMPLE_INFO } from './sample';
import { resetImportController, setImportBackend } from './registry';
import { inProcessBackend } from './testing/in-process-backend';
import { polyfillBlob } from './testing/blob-polyfill';

const asset = readFileSync(resolve(__dirname, 'sample/peter-rabbit.epub'));
const okFetch = () => vi.fn(async () => new Response(new Blob([new Uint8Array(asset)]), { status: 200 }));

let services: AppServices;
beforeAll(polyfillBlob);
beforeEach(() => {
  services = makeServices('sample-book');
  resetImportController();
  setImportBackend(() => inProcessBackend(services.db));
});
afterEach(async () => {
  resetImportController();
  services.covers.dispose();
  services.data.close();
  services.db.close();
  await services.db.delete();
});

describe('SampleBookProvider (contract in src/app/contracts/sample-book.ts)', () => {
  it('describes the book and its license in plain words', () => {
    const provider = createSampleBookProvider();
    expect(provider.info).toBe(SAMPLE_INFO);
    expect(SAMPLE_INFO).toMatchObject({ title: 'The Tale of Peter Rabbit', author: 'Beatrix Potter', license: 'Public domain' });
    expect(SAMPLE_INFO.provenance).toMatch(/Project Gutenberg/);
  });

  it('is small and really an EPUB (a zip), so it is cheap to fetch and carries no surprises', () => {
    expect(asset.byteLength).toBeLessThan(1_000_000);
    expect([...asset.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('downloads nothing until the person taps', () => {
    const fetchFn = okFetch();
    createSampleBookProvider({ fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fetches once from our own origin and imports it through the normal path', async () => {
    const fetchFn = okFetch();
    const started = performance.now();
    const result = await createSampleBookProvider({ fetchFn, url: '/assets/peter-rabbit.epub' }).importSample();
    expect(performance.now() - started).toBeLessThan(30_000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url] = fetchFn.mock.calls[0] as unknown as [string];
    expect(url.startsWith('/')).toBe(true);
    expect(url.startsWith('//')).toBe(false);
    expect(result).toMatchObject({ kind: 'ebook', format: 'epub', title: 'The Tale of Peter Rabbit', alreadyInLibrary: false });
    const row = await services.db.books.get(result.bookId);
    expect(row).toMatchObject({ format: 'epub', title: 'The Tale of Peter Rabbit', author: 'Beatrix Potter' });
    expect(row?.fingerprint).toBeTruthy();
  });

  it('adds the sample once: a second tap points at the same book', async () => {
    const provider = createSampleBookProvider({ fetchFn: okFetch() });
    const first = await provider.importSample();
    const second = await provider.importSample();
    expect(second).toMatchObject({ alreadyInLibrary: true, bookId: first.bookId, kind: 'ebook', format: 'epub' });
    expect(await services.db.books.count()).toBe(1);
  });

  it('fails in plain words when the file cannot be fetched, and works when tried again', async () => {
    let fail = true;
    const fetchFn = vi.fn(async () => (fail ? new Response('nope', { status: 503 }) : new Response(new Blob([new Uint8Array(asset)]))));
    const provider = createSampleBookProvider({ fetchFn });
    await expect(provider.importSample()).rejects.toThrow('Could not add the sample book. Check your connection and try again.');
    expect(await services.db.books.count()).toBe(0);
    fail = false;
    await expect(provider.importSample()).resolves.toMatchObject({ alreadyInLibrary: false });
    const offline = createSampleBookProvider({ fetchFn: vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))) });
    await expect(offline.importSample()).rejects.toThrow(/Check your connection/);
  });

  it('rejects an empty or damaged download in plain words and adds nothing', async () => {
    const empty = createSampleBookProvider({ fetchFn: vi.fn(async () => new Response(new Blob([]))) });
    await expect(empty.importSample()).rejects.toThrow(/Could not add the sample book/);
    const junk = createSampleBookProvider({ fetchFn: vi.fn(async () => new Response(new Blob([new Uint8Array(500).fill(7)]))) });
    await expect(junk.importSample()).rejects.toThrow(/Could not add the sample book/);
    expect(await services.db.books.count()).toBe(0);
  });

  it('is not precached by the service worker', () => {
    const config = readFileSync(resolve(__dirname, '../../../vite.config.ts'), 'utf8');
    expect(config).not.toMatch(/epub/i);
    expect(config).toMatch(/globPatterns:\s*\['\*\*\/\*\.\{js,css,html,png,svg,ico,webmanifest\}'/);
  });

  it('has its provenance and license written down', () => {
    const licenses = readFileSync(resolve(__dirname, '../../../docs/LICENSES.md'), 'utf8');
    expect(licenses).toMatch(/Peter Rabbit/);
    expect(licenses).toMatch(/Project Gutenberg/);
    expect(licenses).toMatch(/14838/);
  });
});
