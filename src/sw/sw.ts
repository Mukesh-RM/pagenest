/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { BOOK_FILE_BYTES_CACHE } from '@/data/cache-file-store';
import { engineCacheFirst, pruneEngineCache } from './engine-cache';
import { cacheFirst } from './font-cache';
import { handleShareRequest, SHARE_PATH } from './share-target';

declare const self: ServiceWorkerGlobalScope;

// 1. App shell: precache what the build lists (see vite.config.ts) and answer every page request with
//    index.html, so the installed app launches offline.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/share-target/] }));

// 2. Fonts that are not precached: cache on first use.
registerRoute(
  ({ request, sameOrigin }) => sameOrigin && request.destination === 'font',
  ({ request }) => cacheFirst(request, self.caches),
);

// Decision 15 (docs/DEPLOY.md): lazy engines, the pdf.js worker and the sample book are not precached. They are stored the first
// time they load, then served from the cache, so a format works offline after it has opened once. The precache route above
// answers precached files first, so this only sees the rest.
registerRoute(
  ({ sameOrigin, url }) =>
    sameOrigin &&
    url.pathname.startsWith('/assets/') &&
    /\.(js|mjs|epub)$/.test(url.pathname), // by name, not request.destination: the warm-up fetches files with fetch(), whose destination is empty
  ({ request }) => engineCacheFirst(request, self.caches),
);

// 3. Updates activate promptly: skipWaiting on install and claim open clients on activate, so users are not stuck on an old
//    precache. The page shows "Update available, reload" and reloads only when the user taps Refresh (never while audio plays).
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await pruneEngineCache(self.caches).catch(() => undefined);
      // Book bytes live in BOOK_FILE_BYTES_CACHE when OPFS is blocked; Workbox precache cleanup must never remove it.
      void BOOK_FILE_BYTES_CACHE;
    })(),
  );
});
self.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | undefined;
  if (data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// 4. Share Target (Android): POST /share-target with files.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method === 'POST' && new URL(request.url).pathname === SHARE_PATH) {
    event.respondWith(handleShareRequest(request, self.caches));
  }
});
