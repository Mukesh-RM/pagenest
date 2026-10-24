/**
 * Only Inter and Literata are precached (Decision 3). Every other font is stored the first time it is used
 * and then served from the cache, so it still works offline afterwards.
 */
export const FONT_CACHE = 'pagenest-fonts-v1';

export async function cacheFirst(
  request: Request,
  cacheStorage: CacheStorage,
  fetcher: (request: Request) => Promise<Response> = (r) => fetch(r),
  cacheName: string = FONT_CACHE,
): Promise<Response> {
  const cache = await cacheStorage.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetcher(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
