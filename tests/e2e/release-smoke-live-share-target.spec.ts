import { expect, test, type Page } from '@playwright/test';
import { skipOnboarding, waitForLiveAppReady, waitForServiceWorkerControl } from './support/app';

const live = process.env.PAGENEST_SMOKE_LIVE === '1';

type Manifest = {
  share_target?: { action?: string; method?: string };
};

async function loadManifest(page: Page): Promise<Manifest> {
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href, 'manifest link').toBeTruthy();
  const url = new URL(href!, page.url()).toString();
  const res = await page.request.get(url);
  expect(res.status()).toBe(200);
  return (await res.json()) as Manifest;
}

async function primeServiceWorker(page: Page): Promise<void> {
  await page.goto('./');
  await skipOnboarding(page);
  await waitForLiveAppReady(page);
  await page.reload();
  await waitForServiceWorkerControl(page);
}

test('live deploy: manifest Share Target and POST inbox (blueprint Phase 1)', async ({ page }, testInfo) => {
  test.skip(!live, 'Set PAGENEST_SMOKE_LIVE=1 (npm run smoke:live).');
  test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name));
  test.setTimeout(120_000);

  await primeServiceWorker(page);
  const manifest = await loadManifest(page);
  expect(manifest.share_target?.action, 'share_target.action').toBeTruthy();
  expect(manifest.share_target?.method?.toUpperCase(), 'share_target.method').toBe('POST');

  const result = await page.evaluate(async () => {
    const form = new FormData();
    form.append('files', new File(['%PDF-1.4 live'], 'shared-live.pdf', { type: 'application/pdf' }));
    const response = await fetch('/share-target', { method: 'POST', body: form, redirect: 'follow' });
    const cache = await caches.open('pagenest-share-inbox-v1');
    const names: string[] = [];
    for (const key of await cache.keys()) {
      const hit = await cache.match(key);
      if (hit) names.push(decodeURIComponent(hit.headers.get('X-File-Name') ?? ''));
    }
    return { finalUrl: response.url, names };
  });

  expect(new URL(result.finalUrl).search).toBe('?share=1');
  expect(result.names).toContain('shared-live.pdf');
});
