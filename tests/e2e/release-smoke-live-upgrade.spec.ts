import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test, webkit } from '@playwright/test';
import { dismissReaderInterstitials, waitForFoliateBookTextLive } from './support/foliate-reader';
import { dismissLibraryOverlays, primeSmokeHints, skipOnboarding, waitForIndexedDbReady, waitForServiceWorkerControl } from './support/app';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const live = process.env.PAGENEST_SMOKE_LIVE === '1';
const host = process.env.PAGENEST_SMOKE_LIVE_HOST ?? 'live';
const shotDir = join(repoRoot, 'docs/screens/release-smoke-live', host);

test.describe.configure({ mode: 'serial' });

test('upgraded profile: import on live URL then reopen after reload', async ({ context }, testInfo) => {
  void context;
  test.skip(!live, 'Set PAGENEST_SMOKE_LIVE=1 (npm run smoke:live).');
  test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name));
  test.setTimeout(600_000);

  const profile = join(repoRoot, 'tests/test-results/live-profile', host, testInfo.project.name);
  mkdirSync(profile, { recursive: true });

  const epub = readFileSync(join(repoRoot, 'src/features/reader/fixtures/alice.epub'));
  const errors: string[] = [];

  const browserType = testInfo.project.name === 'release-smoke-webkit' ? webkit : chromium;
  const browser = await browserType.launchPersistentContext(profile, {
    viewport: { width: 360, height: 740 },
    baseURL: process.env.PAGENEST_BASE_URL,
    serviceWorkers: 'allow',
  });
  await primeSmokeHints(browser);
  const page = browser.pages()[0] ?? (await browser.newPage());
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('./');
  await skipOnboarding(page);
  await dismissLibraryOverlays(page);
  await waitForIndexedDbReady(page);
  await waitForServiceWorkerControl(page);
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, `${testInfo.project.name}-upgrade-01-import.png`), fullPage: true });

  await page.getByRole('button', { name: 'Add books' }).first().click();
  await page.getByTestId('pick-files').setInputFiles({
    name: 'alice.epub',
    mimeType: 'application/epub+zip',
    buffer: epub,
  });
  await expect(page.getByRole('button', { name: /Alice|Wonderland/i }).first()).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: /Alice|Wonderland/i }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /^(start reading|continue reading|read|open)/i }).first().click();
  await expect(page).toHaveURL(/\/read\//, { timeout: 120_000 });
  await dismissReaderInterstitials(page);
  await waitForFoliateBookTextLive(page, { min: 200, needle: 'Alice', timeout: 120_000 });
  await page.screenshot({ path: join(shotDir, `${testInfo.project.name}-upgrade-02-epub-open.png`), fullPage: true });

  await page.reload();
  await waitForServiceWorkerControl(page);
  await page.goto('./');
  await dismissLibraryOverlays(page);
  await page.getByRole('button', { name: /Alice|Wonderland/i }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /^(start reading|continue reading|read|open)/i }).first().click();
  await expect(page).toHaveURL(/\/read\//, { timeout: 120_000 });
  await dismissReaderInterstitials(page);
  await waitForFoliateBookTextLive(page, { min: 200, needle: 'Alice', timeout: 120_000 });
  await expect(page.getByText(/file for this book is missing/i)).toHaveCount(0);
  await page.screenshot({ path: join(shotDir, `${testInfo.project.name}-upgrade-03-after-reload.png`), fullPage: true });

  expect(errors, errors.join('\n')).toEqual([]);
  await browser.close();
});
