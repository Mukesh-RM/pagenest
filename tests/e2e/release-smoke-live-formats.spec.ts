import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test, webkit, type BrowserContext, type Page } from '@playwright/test';
import {
  dismissLibraryOverlays,
  primeSmokeHints,
  skipOnboarding,
  waitForLiveAppReady,
} from './support/app';
import { attachReleaseSmokeConsoleGuard } from './support/release-smoke-console';
import { dismissReaderInterstitials, waitForFoliateBookTextLive } from './support/foliate-reader';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const live = process.env.PAGENEST_SMOKE_LIVE === '1';
const host = process.env.PAGENEST_SMOKE_LIVE_HOST ?? 'live';
const shotDir = join(repoRoot, 'docs/screens/release-smoke-live', host);
const VIEW = { width: 360, height: 740 };

function readFixture(rel: string): Buffer {
  return readFileSync(join(repoRoot, rel));
}

async function snap(page: Page, project: string, slug: string): Promise<void> {
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, `${project}-formats-${slug}-open.png`), fullPage: true });
}

async function primeLibrary(page: Page): Promise<void> {
  await page.goto('./');
  await skipOnboarding(page);
  await dismissLibraryOverlays(page);
  await waitForLiveAppReady(page);
}

async function openByFormatLabel(page: Page, format: RegExp): Promise<void> {
  await dismissLibraryOverlays(page);
  const cards = page.getByRole('button', { name: /Alice|Wonderland/i });
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
  throw new Error(`No book detail matched ${format}`);
}

const CASES = [
  {
    slug: 'mobi',
    file: { name: 'alice.mobi', mimeType: 'application/x-mobipocket-ebook', path: 'src/features/reader/fixtures/alice.mobi' },
    format: /MOBI/i,
    ready: async (page: Page) => {
      await waitForFoliateBookTextLive(page, { min: 80, needle: 'Alice', timeout: 120_000 });
    },
  },
  {
    slug: 'fb2',
    file: { name: 'alice.fb2', mimeType: 'application/x-fictionbook+xml', path: 'src/features/reader/fixtures/alice.fb2' },
    format: /FB2/i,
    ready: async (page: Page) => {
      await waitForFoliateBookTextLive(page, { min: 80, needle: 'Alice', timeout: 120_000 });
    },
  },
  {
    slug: 'txt',
    file: { name: 'alice.txt', mimeType: 'text/plain', path: 'src/features/reader/fixtures/alice.txt' },
    format: /TXT/i,
    ready: async (page: Page) => {
      await waitForFoliateBookTextLive(page, { min: 80, needle: 'Alice', timeout: 120_000 });
    },
  },
  {
    slug: 'cbz',
    file: { name: 'alice.cbz', mimeType: 'application/vnd.comicbook+zip', path: 'src/features/reader/fixtures/alice.cbz' },
    format: /CBZ/i,
    ready: async (page: Page) => {
      await expect(page.getByText(/Page 1 of \d+/).first()).toBeVisible({ timeout: 120_000 });
    },
  },
  {
    slug: 'pdf',
    file: { name: 'alice.pdf', mimeType: 'application/pdf', path: 'src/features/reader/fixtures/alice.pdf' },
    format: /PDF/i,
    ready: async (page: Page) => {
      await page.locator('.pn-pdf-page[data-rendered="true"] canvas').first().waitFor({ state: 'visible', timeout: 120_000 });
    },
  },
] as const;

test.describe('live format fixtures open in the reader', () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    test.skip(!live, 'Set PAGENEST_SMOKE_LIVE=1 (npm run smoke:live).');
    test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name));
    await primeSmokeHints(context);
    await page.setViewportSize(VIEW);
  });

  test('MOBI, FB2, TXT, CBZ, PDF from repo fixtures', async ({ page: fixturePage, context, playwright }, testInfo) => {
    test.setTimeout(900_000);
    const project = testInfo.project.name;
    let page: Page = fixturePage;
    let liveBrowser: BrowserContext | undefined;
    if (live && host) {
      const profile = join(repoRoot, 'tests/test-results/live-profile', host, `${project}-formats`);
      rmSync(profile, { recursive: true, force: true });
      mkdirSync(profile, { recursive: true });
      const browserType = project === 'release-smoke-webkit' ? webkit : chromium;
      liveBrowser = await browserType.launchPersistentContext(profile, {
        viewport: VIEW,
        baseURL: process.env.PAGENEST_BASE_URL,
        serviceWorkers: 'allow',
      });
      await primeSmokeHints(liveBrowser);
      page = liveBrowser.pages()[0] ?? (await liveBrowser.newPage());
      await page.setViewportSize(VIEW);
    }

    const errors: string[] = [];
    attachReleaseSmokeConsoleGuard(page, errors);

    await primeLibrary(page);

    const importBatch = CASES.map((item) => ({
      name: item.file.name,
      mimeType: item.file.mimeType,
      buffer: readFixture(item.file.path),
    }));
    await page.getByRole('button', { name: 'Add books' }).first().click();
    await page.getByTestId('pick-files').setInputFiles(importBatch);
    await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 8000 }).catch(() => undefined);
    await expect(page.getByRole('button', { name: /Alice|Wonderland/i }).first()).toBeVisible({ timeout: 180_000 });

    for (const item of CASES) {
      await openByFormatLabel(page, item.format);
      await item.ready(page);
      await snap(page, project, item.slug);
      await page.goto('./');
      await dismissLibraryOverlays(page);
    }

    expect(errors, errors.join('\n')).toEqual([]);
    await liveBrowser?.close();
  });
});
