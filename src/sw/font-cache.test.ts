// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { cacheFirst, FONT_CACHE } from './font-cache';
import { MemoryCacheStorage } from './test-cache';

const request = () => new Request('https://pagenest.test/assets/lora-latin-400-normal.woff2');

describe('cacheFirst (fonts that are not precached)', () => {
  it('fetches once, then serves from the cache without the network', async () => {
    const storage = new MemoryCacheStorage();
    const fetcher = vi.fn(async () => new Response('font-bytes', { status: 200 }));
    const first = await cacheFirst(request(), storage.asCacheStorage(), fetcher);
    expect(await first.text()).toBe('font-bytes');
    const second = await cacheFirst(request(), storage.asCacheStorage(), async () => {
      throw new Error('offline');
    });
    expect(await second.text()).toBe('font-bytes');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await storage.has(FONT_CACHE)).toBe(true);
  });

  it('does not cache a failed response', async () => {
    const storage = new MemoryCacheStorage();
    await cacheFirst(request(), storage.asCacheStorage(), async () => new Response('nope', { status: 404 }));
    const retry = vi.fn(async () => new Response('ok'));
    await cacheFirst(request(), storage.asCacheStorage(), retry);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
