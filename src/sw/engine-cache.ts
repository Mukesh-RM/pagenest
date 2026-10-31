/**
 * Runtime cache of the Reader's lazy engines, the pdf.js worker and the sample book (Decision 15, docs/DEPLOY.md).
 * They are not precached (they are large); each is stored the first time it loads and then served from here, so a format
 * keeps working offline.
 *
 * Built file names carry a content hash (`engine-pdf-D_i92D7q.js`). A new build means new names, so the old files could
 * never be asked for again. `pruneEngineCache` removes them: of every file name with the hash taken off, only the newest
 * stored copy stays, and the cache never holds more than `MAX_ENGINE_ENTRIES` files.
 */
import { cacheFirst } from './font-cache';

export const ENGINE_CACHE = 'pn-engines-v1';
export const MAX_ENGINE_ENTRIES = 40;

const HASHED = /^(.*)-[A-Za-z0-9_-]{8}(\.[A-Za-z0-9]+)$/;

/** `/assets/engine-pdf-D_i92D7q.js` and `/assets/engine-pdf-Xy12AbCd.js` are the same file in two builds. */
export function lineageOf(pathname: string): string {
  const m = HASHED.exec(pathname);
  return m ? `${m[1]}${m[2]}` : pathname;
}

export async function pruneEngineCache(cacheStorage: CacheStorage, max: number = MAX_ENGINE_ENTRIES): Promise<number> {
  const cache = await cacheStorage.open(ENGINE_CACHE);
  const keys = await cache.keys(); // oldest first
  const newestOfLineage = new Map<string, number>();
  keys.forEach((request, i) => newestOfLineage.set(lineageOf(new URL(request.url).pathname), i));
  let kept = keys.filter((request, i) => newestOfLineage.get(lineageOf(new URL(request.url).pathname)) === i);
  const stale = keys.filter((request) => !kept.includes(request));
  if (kept.length > max) {
    stale.push(...kept.slice(0, kept.length - max));
    kept = kept.slice(kept.length - max);
  }
  await Promise.all(stale.map((request) => cache.delete(request)));
  return stale.length;
}

/** Cache first, in the engine cache. A newly stored file also prunes the older builds of itself. */
export async function engineCacheFirst(
  request: Request,
  cacheStorage: CacheStorage,
  fetcher: (request: Request) => Promise<Response> = (r) => fetch(r),
): Promise<Response> {
  const cache = await cacheStorage.open(ENGINE_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await cacheFirst(request, cacheStorage, fetcher, ENGINE_CACHE);
  await pruneEngineCache(cacheStorage).catch(() => undefined);
  return response;
}
