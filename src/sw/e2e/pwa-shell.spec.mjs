import { expect, test } from '@playwright/test';

async function firstLoad(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The first worker does not claim the page, so it controls it from the next load on (an update applies on a launch).
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

test('opens offline after the first load (offline launch, blueprint 14)', async ({ page, context }) => {
  await firstLoad(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
  // A deep link works offline too: every navigation falls back to the precached index.html.
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await context.setOffline(false);
});

test('precaches the shell, icons and manifest', async ({ page }) => {
  await firstLoad(page);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls = [];
    for (const name of names) for (const r of await (await caches.open(name)).keys()) urls.push(new URL(r.url).pathname);
    return urls;
  });
  for (const expected of ['/index.html', '/manifest.webmanifest', '/apple-touch-icon.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/favicon.svg']) {
    expect(cached, expected).toContain(expected);
  }
});

test('a new version waits: it is not applied until the page asks (no auto skipWaiting)', async ({ page, request }) => {
  await firstLoad(page);
  const before = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL);
  await page.evaluate(() => {
    window.__reloaded = false;
    window.addEventListener('pagehide', () => (window.__reloaded = true));
  });
  await request.get('/__bump');
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);
  // Give an unwanted skipWaiting plenty of time to happen.
  await page.waitForTimeout(1500);
  const state = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return { waiting: reg?.waiting?.state, active: reg?.active?.state, reloaded: window.__reloaded };
  });
  expect(state.waiting).toBe('installed');
  expect(state.active).toBe('activated');
  expect(state.reloaded).toBe(false);

  // The user taps Refresh: the page posts SKIP_WAITING and the waiting worker takes over.
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.postMessage({ type: 'SKIP_WAITING' }));
  await page.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration())?.waiting);
  expect(before).toContain('/sw.js');
});

test('Web Share Target: a shared PDF and MP3 reach the inbox and the app is opened', async ({ page }) => {
  await firstLoad(page);
  const result = await page.evaluate(async () => {
    const form = new FormData();
    form.append('files', new File(['%PDF-1.4'], 'My Book.pdf', { type: 'application/pdf' }));
    form.append('files', new File(['ID3'], 'Chapter 1.mp3', { type: 'audio/mpeg' }));
    const response = await fetch('/share-target', { method: 'POST', body: form });
    const cache = await caches.open('pagenest-share-inbox-v1');
    const entries = [];
    for (const key of await cache.keys()) {
      const hit = await cache.match(key);
      entries.push({ name: decodeURIComponent(hit.headers.get('X-File-Name')), type: hit.headers.get('Content-Type'), size: (await hit.blob()).size });
    }
    return { url: response.url, redirected: response.redirected, status: response.status, entries };
  });
  expect(result.redirected).toBe(true);
  expect(new URL(result.url).search).toBe('?share=2');
  expect(result.entries).toEqual([
    { name: 'My Book.pdf', type: 'application/pdf', size: 8 },
    { name: 'Chapter 1.mp3', type: 'audio/mpeg', size: 3 },
  ]);
});

test('persistent storage can be requested and answers', async ({ page }) => {
  await firstLoad(page);
  const answer = await page.evaluate(async () => ({ supported: !!navigator.storage?.persist, persisted: await navigator.storage.persisted() }));
  expect(answer.supported).toBe(true);
  expect(typeof answer.persisted).toBe('boolean');
});

test('after loading, the app makes no request to any other origin', async ({ page }) => {
  const foreign = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol.startsWith('http')) foreign.push(r.url());
  });
  await firstLoad(page);
  expect(foreign).toEqual([]);
});
