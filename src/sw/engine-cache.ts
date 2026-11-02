/**
 * Runtime cache of large Reader assets and the sample book (Decision 15, docs/DEPLOY.md).
 * Lazy engines are also in the Workbox precache; this cache keeps **older hashed builds** around after an update so an
 * open tab or a slow reload can still import the previous chunk once.
 */
import { cacheFirst } from './font-cache';

export const ENGINE_CACHE = 'pn-engines-v1';
export const MAX_ENGINE_ENTRIES = 40;
/** How many hashed builds of the same logical file (lineage) to keep. */
export const LINEAGE_RETAIN = 2;

const HASHED = /^(.*)-[A-Za-z0-9_-]{8}(\.[A-Za-z0-9]+)$/;

/** `/assets/engine-pdf-D_i92D7q.js` and `/assets/engine-pdf-Xy12AbCd.js` are the same file in two builds. */
export function lineageOf(pathname: string): string {
  const m = HASHED.exec(pathname);
  return m ? `${m[1]}${m[2]}` : pathname;
}

export async function pruneEngineCache(cacheStorage: CacheStorage, max: number = MAX_ENGINE_ENTRIES): Promise<number> {
  const cache = await cacheStorage.open(ENGINE_CACHE);
  const keys = await cache.keys(); // oldest first
  const byLineage = new Map<string, number[]>();
  keys.forEach((request, i) => {
    const lineage = lineageOf(new URL(request.url).pathname);
    const list = byLineage.get(lineage) ?? [];
    list.push(i);
    byLineage.set(lineage, list);
  });
  const keep = new Set<number>();
  for (const indices of byLineage.values()) {
    for (const i of indices.slice(-LINEAGE_RETAIN)) keep.add(i);
  }
  let kept = keys.filter((_, i) => keep.has(i));
  const stale = keys.filter((_, i) => !keep.has(i));
  if (kept.length > max) {
    stale.push(...kept.slice(0, kept.length - max));
    kept = kept.slice(kept.length - max);
  }
  await Promise.all(stale.map((request) => cache.delete(request)));
  return stale.length;
}

/** Cache first, in the engine cache. Pruning runs on activate, not on every fetch. */
export async function engineCacheFirst(
  request: Request,
  cacheStorage: CacheStorage,
  fetcher: (request: Request) => Promise<Response> = (r) => fetch(r),
): Promise<Response> {
  const cache = await cacheStorage.open(ENGINE_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await cacheFirst(request, cacheStorage, fetcher, ENGINE_CACHE);
  return response;
}
