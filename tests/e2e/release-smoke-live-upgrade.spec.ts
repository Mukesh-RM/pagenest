import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test, webkit } from '@playwright/test';
import { isBenignReleaseSmokePageError } from './support/release-smoke-console';
import { dismissReaderInterstitials, waitForFoliateBookTextLive } from './support/foliate-reader';
import { dismissLibraryOverlays, openLibraryFromAnyRoute, primeSmokeHints, skipOnboarding, waitForIndexedDbReady, waitForServiceWorkerControl } from './support/app';

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
  rmSync(profile, { recursive: true, force: true });
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
  page.on('pageerror', (e) => {
    if (isBenignReleaseSmokePageError(e.message)) return;
    errors.push(e.message);
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (isBenignReleaseSmokePageError(text)) return;
    errors.push(text);
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
  await waitForFoliateBookTextLive(page, { min: 200, needle: 'Alice' });
  await page.screenshot({ path: join(shotDir, `${testInfo.project.name}-upgrade-02-epub-open.png`), fullPage: true });

  const scrub = page.getByRole('slider', { name: 'Position in the book' });
  const beforeTurn = Number((await scrub.inputValue().catch(() => '0')) || 0);
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => Number((await scrub.inputValue().catch(() => '0')) || 0), { timeout: 15_000 }).not.toBe(beforeTurn);
  const savedProgress = Number((await scrub.inputValue().catch(() => '0')) || 0);
  expect(savedProgress).toBeGreaterThan(0.02);
  await page.waitForTimeout(2_000);

  // WebKit + service worker: full reload() matches real users; chunk precache + importModule handle stale hashes.
  await page.reload();
  await waitForServiceWorkerControl(page);
  if (page.url().includes('/read/')) {
    await dismissReaderInterstitials(page);
    await waitForFoliateBookTextLive(page, { min: 200, needle: 'Alice' });
  } else {
    await openLibraryFromAnyRoute(page);
    await page.getByRole('button', { name: /Alice|Wonderland/i }).first().click();
    await expect(page.getByRole('dialog').getByRole('button', { name: /^(continue reading|keep reading)/i }).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('dialog').getByRole('button', { name: /^(start reading|continue reading|read|open)/i }).first().click();
    await expect(page).toHaveURL(/\/read\//, { timeout: 120_000 });
    await dismissReaderInterstitials(page);
    await waitForFoliateBookTextLive(page, { min: 200, needle: 'Alice' });
  }
  const scrubAfter = page.getByRole('slider', { name: 'Position in the book' });
  await expect.poll(async () => Number((await scrubAfter.inputValue().catch(() => '0')) || 0), { timeout: 30_000 }).toBeGreaterThanOrEqual(
    savedProgress * 0.85,
  );
  await expect(page.getByText(/file for this book is missing/i)).toHaveCount(0);
  await page.screenshot({ path: join(shotDir, `${testInfo.project.name}-upgrade-03-after-reload.png`), fullPage: true });

  expect(errors, errors.join('\n')).toEqual([]);
  await browser.close();
});
