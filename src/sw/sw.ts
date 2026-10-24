/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
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
  ({ request, sameOrigin, url }) =>
    sameOrigin &&
    url.pathname.startsWith('/assets/') &&
    (request.destination === 'script' || request.destination === 'worker' || /\.(mjs|epub)$/.test(url.pathname)),
  ({ request }) => cacheFirst(request, self.caches, undefined, 'pn-engines-v1'),
);

// 3. Updates wait. There is no skipWaiting() on install and no clients.claim(), so a new version applies on the
//    next launch, or when the page asks for it after the user taps Refresh (never while audio plays).
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
