import { cacheNames } from 'workbox-core';
import { ENGINE_CACHE } from './engine-cache';

/**
 * Before Workbox deletes an outdated precache, copy hashed JS/MJS assets into the engine runtime cache so an open tab
 * can still import the previous build once after an update (Decision 15 lineage retain).
 */
export async function snapshotOutdatedPrecacheToEngine(
  cacheStorage: CacheStorage,
  currentPrecache?: string,
): Promise<number> {
  const activePrecache = currentPrecache ?? (await cacheNames.precache);
  const engine = await cacheStorage.open(ENGINE_CACHE);
  let copied = 0;
  for (const name of await cacheStorage.keys()) {
    if (name === activePrecache || name === ENGINE_CACHE) continue;
    if (!/precache/i.test(name)) continue;
    const cache = await cacheStorage.open(name);
    for (const request of await cache.keys()) {
      const { pathname } = new URL(request.url);
      if (!pathname.startsWith('/assets/') || !/\.(js|mjs)$/.test(pathname)) continue;
      const response = await cache.match(request);
      if (!response?.ok) continue;
      await engine.put(request, response.clone());
      copied += 1;
    }
  }
  return copied;
}
