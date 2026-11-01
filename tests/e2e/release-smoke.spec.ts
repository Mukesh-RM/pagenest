import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { launch, skipOnboarding, waitForIndexedDbReady, waitForServiceWorkerControl } from './support/app';
import { dismissReaderInterstitials, waitForFoliateBookText } from './support/foliate-reader';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const liveHost = process.env.PAGENEST_SMOKE_LIVE_HOST;
const shotDir = liveHost
  ? join(repoRoot, 'docs/screens/release-smoke-live', liveHost)
  : join(repoRoot, 'docs/screens/release-smoke');

const VIEW = { width: 360, height: 740 };

function readFixture(rel: string): Buffer {
  return readFileSync(join(repoRoot, rel));
}

function attachConsoleGuard(page: Page, errors: string[]): void {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
}

async function snap(page: Page, name: string): Promise<void> {
  mkdirSync(shotDir, { recursive: true });
  const slug = name.replace(/[^\w.-]+/g, '-').toLowerCase();
  const project = test.info().project.name;
  await page.screenshot({ path: join(shotDir, `${project}-${slug}.png`), fullPage: true });
}

async function importFiles(
  page: Page,
  files: Array<{ name: string; mimeType: string; buffer: Buffer }>,
  waitForCard?: RegExp,
): Promise<void> {
  await page.getByRole('button', { name: 'Add books' }).first().click();
  await page.getByTestId('pick-files').setInputFiles(files);
  await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 8000 }).catch(() => undefined);
  if (waitForCard) await expect(page.getByRole('button', { name: waitForCard }).first()).toBeVisible({ timeout: 120_000 });
}

async function dismissLibraryOverlays(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Got it' }).click({ timeout: 2000 }).catch(() => undefined);
  await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 2000 }).catch(() => undefined);
}

async function openBookByFormat(page: Page, title: RegExp, format: RegExp): Promise<void> {
  await dismissLibraryOverlays(page);
  const cards = page.getByRole('button', { name: title });
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    await cards.nth(i).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    const meta = await sheet.innerText();
    if (format.test(meta)) {
      await sheet.getByRole('button', { name: /^(start reading|continue reading)$/i }).click();
      await expect(page).toHaveURL(/\/read\//, { timeout: 120_000 });
      await dismissReaderInterstitials(page);
      return;
    }
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden({ timeout: 5000 }).catch(() => undefined);
  }
  throw new Error(`No ${format} book found for ${title}`);
}

async function openBookCard(page: Page, title: RegExp): Promise<void> {
  await openBookByFormat(page, title, /EPUB/i);
}

async function openPdfFromLibrary(page: Page, title: RegExp): Promise<void> {
  await openBookByFormat(page, title, /PDF/i);
  await page.locator('.pn-pdf-page[data-rendered="true"] canvas').first().waitFor({ state: 'visible', timeout: 120_000 });
}

async function importAndListenMp3(page: Page): Promise<void> {
  await importFiles(page, [{ name: 'tones.mp3', mimeType: 'audio/mpeg', buffer: readFixture('src/features/library/e2e/audio-fixtures/tone-book.mp3') }], /Tone Book/i);
  const card = page.getByRole('button', { name: 'Tone Book' }).first();
  await expect(card).toBeVisible({ timeout: 120_000 });
  await card.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page).toHaveURL(/\/listen\//, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 30_000 });
}

async function bumpServiceWorker(page: Page, bump: { version: number }): Promise<void> {
  bump.version += 1;
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
  });
  await page.waitForTimeout(500);
  await page.reload();
  await waitForServiceWorkerControl(page);
}

test.describe.configure({ mode: 'serial' });

test.describe('release smoke: import, open, reload, SW update', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name), 'Release smoke project only.');
    await page.setViewportSize(VIEW);
  });

  test('fresh profile imports EPUB, PDF, MP3; opens; survives reload and SW bump', async ({ page, context }) => {
    test.setTimeout(600_000);
    const consoleErrors: string[] = [];
    attachConsoleGuard(page, consoleErrors);
    const swVersion = 1;
    await page.route('**/sw.js', async (route) => {
      const response = await route.fetch();
      const body = `${await response.text()}\n/* release-smoke v${swVersion} */`;
      await route.fulfill({ response, body, headers: response.headers() });
    });

    await context.clearCookies();
    await page.goto('./');
    await skipOnboarding(page);
    await dismissLibraryOverlays(page);
    await waitForIndexedDbReady(page);
    await waitForServiceWorkerControl(page);
    await snap(page, '01-library');

    const epub = readFixture('src/features/reader/fixtures/alice.epub');
    const pdf = readFixture('src/features/reader/fixtures/alice.pdf');
    await importFiles(page, [{ name: 'alice.epub', mimeType: 'application/epub+zip', buffer: epub }], /Alice|Wonderland/i);
    await snap(page, '02-imported-epub');

    await openBookCard(page, /Alice|Wonderland/i);
    const text = await waitForFoliateBookText(page, { min: 200, needle: 'Alice', timeout: 120_000 });
    expect(text).toContain('Alice');
    const epubReadUrl = page.url();
    await snap(page, '03-epub-open');
    await expect(page.getByText(/file for this book is missing/i)).toHaveCount(0);

    await page.goto('./');
    await importFiles(page, [{ name: 'alice.pdf', mimeType: 'application/pdf', buffer: pdf }], /Alice|Wonderland/i);
    await snap(page, '04-imported-pdf');

    await openPdfFromLibrary(page, /Alice|Wonderland/i);
    const pdfReadUrl = page.url();
    await snap(page, '05-pdf-open');

    await page.goto('./');
    await importAndListenMp3(page);
    const listenUrl = page.url();
    await snap(page, '06-audio-playing');

    await page.reload();
    await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 30_000 });

    await page.goto(epubReadUrl);
    await waitForFoliateBookText(page, { min: 200, needle: 'Alice', timeout: 120_000 });
    await snap(page, '07-epub-after-reload');

    const swBump = { version: 1 };
    await bumpServiceWorker(page, swBump);
    await page.goto('./');
    await snap(page, '08-library-after-sw-bump');
    await page.goto(epubReadUrl);
    await waitForFoliateBookText(page, { min: 200, needle: 'Alice', timeout: 120_000 });
    await page.goto(pdfReadUrl);
    await page.locator('.pn-pdf-page[data-rendered="true"] canvas').first().waitFor({ state: 'visible', timeout: 120_000 });
    await page.goto(listenUrl);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 30_000 });
    await snap(page, '09-all-formats-after-sw-bump');

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });

  test('OPFS blocked: cache-backed store still imports and opens EPUB', async ({ page, context }) => {
    test.skip(process.env.PAGENEST_SMOKE_LIVE === '1', 'Local profile only (live smoke uses real OPFS).');
    test.setTimeout(300_000);
    const consoleErrors: string[] = [];
    attachConsoleGuard(page, consoleErrors);

    await context.addInitScript(() => {
      sessionStorage.setItem('pn_no_opfs', '1');
    });

    await context.clearCookies();
    await page.goto('./?pn_no_opfs=1');
    await skipOnboarding(page);
    await waitForIndexedDbReady(page);
    await waitForServiceWorkerControl(page);

    const epub = readFixture('src/features/reader/fixtures/alice.epub');
    await importFiles(page, [{ name: 'alice.epub', mimeType: 'application/epub+zip', buffer: epub }], /Alice|Wonderland/i);
    await openBookCard(page, /Alice|Wonderland/i);
    await waitForFoliateBookText(page, { min: 200, needle: 'Alice', timeout: 120_000 });
    await page.reload();
    await waitForServiceWorkerControl(page);
    await page.goto('./?pn_no_opfs=1');
    await dismissLibraryOverlays(page);
    await waitForIndexedDbReady(page);
    await openBookCard(page, /Alice|Wonderland/i);
    await waitForFoliateBookText(page, { min: 200, needle: 'Alice', timeout: 120_000 });
    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });
});
