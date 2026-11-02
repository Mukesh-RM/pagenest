import { describe, expect, it } from 'vitest';
import { ENGINE_CACHE } from './engine-cache';
import { snapshotOutdatedPrecacheToEngine } from './preserve-precache';

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
  return { open, keys: async () => [...stores.keys()] } as unknown as CacheStorage;
}

describe('snapshotOutdatedPrecacheToEngine', () => {
  it('copies JS assets from an outdated precache into the engine cache', async () => {
    const caches = memoryCaches();
    const old = await caches.open('workbox-precache-v1-old');
    const req = new Request('https://pagenest.test/assets/PlayerScreen-OLDHASH.js');
    await old.put(req, new Response('old chunk', { status: 200 }));
    const copied = await snapshotOutdatedPrecacheToEngine(caches, 'workbox-precache-v1-current');
    expect(copied).toBe(1);
    const engine = await caches.open(ENGINE_CACHE);
    expect(await (await engine.match(req))?.text()).toBe('old chunk');
  });
});
