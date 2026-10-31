/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
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

// 3. Updates wait. There is no skipWaiting() on install, so a new version applies on the next launch, or when the page asks
//    for it after the user taps Refresh (never while audio plays). The one exception is the very first install: there is no
//    older version to replace and no open page depends on one, so the worker takes control of the page that installed it.
//    Without that, the first visit would run uncontrolled and nothing it loads (the engines, the sample book) could reach the
//    cache until a reload. Every later update still waits.
let firstInstall = false;
self.addEventListener('install', () => {
  firstInstall = self.registration.active === null;
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (firstInstall) await self.clients.claim();
      await pruneEngineCache(self.caches).catch(() => undefined); // engine files of older builds can never be asked for again
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
