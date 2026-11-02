import { describe, expect, it } from 'vitest';
import { ENGINE_CACHE, engineCacheFirst, lineageOf, pruneEngineCache } from './engine-cache';

/** A small in-memory CacheStorage: keys() in insertion order, like the real one. */
function memoryCaches(): CacheStorage {
  const stores = new Map<string, Map<string, { request: Request; response: Response }>>();
  const open = async (name: string): Promise<Cache> => {
    const store = stores.get(name) ?? new Map();
    stores.set(name, store);
    return {
      match: async (r: Request) => store.get(r.url)?.response.clone(),
      put: async (r: Request, res: Response) => void store.set(r.url, { request: r, response: res }),
      delete: async (r: Request) => store.delete(r.url),
      keys: async () => [...store.values()].map((e) => e.request),
    } as unknown as Cache;
  };
  return { open } as unknown as CacheStorage;
}

const req = (path: string): Request => new Request(`https://pagenest.test${path}`);
const names = async (c: CacheStorage): Promise<string[]> => (await (await c.open(ENGINE_CACHE)).keys()).map((r) => new URL(r.url).pathname);

describe('lineageOf', () => {
  it('takes the 8-character build hash off, whatever it contains', () => {
    expect(lineageOf('/assets/engine-pdf-D_i92D7q.js')).toBe('/assets/engine-pdf.js');
    expect(lineageOf('/assets/pdf.worker.min-FHbmGBN0.mjs')).toBe('/assets/pdf.worker.min.mjs');
    expect(lineageOf('/assets/engine-foliate-formats-a-bcdefg.js')).toBe('/assets/engine-foliate-formats.js');
    expect(lineageOf('/assets/peter-rabbit-AbCd1234.epub')).toBe('/assets/peter-rabbit.epub');
  });
  it('leaves a name without a hash alone', () => {
    expect(lineageOf('/assets/readme.js')).toBe('/assets/readme.js');
  });
});

describe('pruneEngineCache', () => {
  it('keeps the newest two copies of each lineage, and every other file', async () => {
    const caches = memoryCaches();
    const cache = await caches.open(ENGINE_CACHE);
    for (const p of ['/assets/engine-pdf-AAAAAAAA.js', '/assets/engine-foliate-BBBBBBBB.js', '/assets/engine-pdf-CCCCCCCC.js']) {
      await cache.put(req(p), new Response('x'));
    }
    expect(await pruneEngineCache(caches)).toBe(0);
    expect(await names(caches)).toEqual([
      '/assets/engine-pdf-AAAAAAAA.js',
      '/assets/engine-foliate-BBBBBBBB.js',
      '/assets/engine-pdf-CCCCCCCC.js',
    ]);
  });

  it('caps the cache, dropping the oldest', async () => {
    const caches = memoryCaches();
    const cache = await caches.open(ENGINE_CACHE);
    for (let i = 0; i < 6; i++) await cache.put(req(`/assets/file${i}-ABCDEFG${i}.js`), new Response('x'));
    await pruneEngineCache(caches, 4);
    expect((await names(caches)).map((n) => n.slice(8, 13))).toEqual(['file2', 'file3', 'file4', 'file5']);
  });
});

describe('engineCacheFirst', () => {
  it('fetches once, then answers from the cache, also when the network is gone', async () => {
    const caches = memoryCaches();
    let fetches = 0;
    const fetcher = async (): Promise<Response> => {
      fetches++;
      return new Response('engine');
    };
    expect(await (await engineCacheFirst(req('/assets/engine-pdf-AAAAAAAA.js'), caches, fetcher)).text()).toBe('engine');
    const offline = async (): Promise<Response> => {
      throw new TypeError('offline');
    };
    expect(await (await engineCacheFirst(req('/assets/engine-pdf-AAAAAAAA.js'), caches, offline)).text()).toBe('engine');
    expect(fetches).toBe(1);
  });

  it('stores a new build without dropping the previous hash (lineage retain)', async () => {
    const caches = memoryCaches();
    const ok = async (): Promise<Response> => new Response('x');
    await engineCacheFirst(req('/assets/engine-pdf-AAAAAAAA.js'), caches, ok);
    await engineCacheFirst(req('/assets/engine-pdf-CCCCCCCC.js'), caches, ok);
    expect(await names(caches)).toEqual(['/assets/engine-pdf-AAAAAAAA.js', '/assets/engine-pdf-CCCCCCCC.js']);
  });

  it('does not store a failed response', async () => {
    const caches = memoryCaches();
    await engineCacheFirst(req('/assets/engine-pdf-AAAAAAAA.js'), caches, async () => new Response('no', { status: 404 }));
    expect(await names(caches)).toEqual([]);
  });
});
