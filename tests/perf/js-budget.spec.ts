import { expect, test } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { BUDGETS } from './budgets';

test.use({ serviceWorkers: 'block' }); // measure what a cold first visit downloads, not what the service worker precaches

test(`initial JavaScript is under ${BUDGETS.initialJs.maxGzipKiB} KiB gzip on a cold first load`, async ({ page }, testInfo) => {
  const scripts = new Map<string, number>();
  const pending: Promise<void>[] = [];
  page.on('response', (res) => {
    const type = res.headers()['content-type'] ?? '';
    const isJs = res.request().resourceType() === 'script' || /javascript/.test(type) || /\.m?js(\?|$)/.test(res.url());
    if (!isJs || res.status() !== 200) return;
    pending.push(res.body().then((b) => { scripts.set(new URL(res.url()).pathname, gzipSync(b, { level: 9 }).length); }, () => {}));
  });
  await page.goto('./', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await Promise.all(pending);

  const rows = [...scripts.entries()].sort((a, b) => b[1] - a[1]);
  const totalKiB = rows.reduce((n, [, size]) => n + size, 0) / 1024;
  const report = `${rows.map(([u, s]) => `  ${(s / 1024).toFixed(1).padStart(7)} KiB  ${u}`).join('\n')}\n  ${totalKiB.toFixed(1).padStart(7)} KiB  TOTAL (budget ${BUDGETS.initialJs.maxGzipKiB} KiB)`;
  console.log(`First-load JavaScript, gzip level 9:\n${report}`);
  await testInfo.attach('initial-js.txt', { body: report, contentType: 'text/plain' });
  expect(rows.length, 'no JavaScript was loaded; the app did not start').toBeGreaterThan(0);
  expect(totalKiB, `first-load JS is ${totalKiB.toFixed(1)} KiB gzip\n${report}`).toBeLessThanOrEqual(BUDGETS.initialJs.maxGzipKiB);
});
