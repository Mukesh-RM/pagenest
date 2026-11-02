import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test, webkit, type BrowserContext, type Page } from '@playwright/test';
import {
  dismissLibraryOverlays,
  gotoTab,
  openLibraryFromAnyRoute,
  primeSmokeHints,
  skipOnboarding,
  waitForLiveAppReady,
  waitForStorageBootstrap,
} from './support/app';
import { attachReleaseSmokeConsoleGuard } from './support/release-smoke-console';
import { dismissReaderInterstitials, tapReaderZone, waitForFoliateBookTextLive } from './support/foliate-reader';
import { openReadAloudControls, primeDeviceSpeechForLiveSmoke } from './support/narration-live';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const live = process.env.PAGENEST_SMOKE_LIVE === '1';
const host = process.env.PAGENEST_SMOKE_LIVE_HOST ?? 'live';
const shotDir = join(repoRoot, 'docs/screens/release-smoke-live', host);
const VIEW = { width: 360, height: 740 };

async function snap(page: Page, project: string, name: string): Promise<void> {
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, `${project}-voice-gate-${name}.png`), fullPage: true });
}

async function openAliceForNarration(page: Page): Promise<void> {
  const epub = readFileSync(join(repoRoot, 'src/features/reader/fixtures/alice.epub'));
  await page.goto('./');
  await skipOnboarding(page);
  await dismissLibraryOverlays(page);
  await waitForLiveAppReady(page);
  await page.getByRole('button', { name: 'Add books' }).first().click();
  await page.getByTestId('pick-files').setInputFiles({
    name: 'alice.epub',
    mimeType: 'application/epub+zip',
    buffer: epub,
  });
  await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 8000 }).catch(() => undefined);
  await expect(page.getByRole('button', { name: /Alice|Wonderland/i }).first()).toBeVisible({ timeout: 120_000 });
  await waitForStorageBootstrap(page);
  const missingHeading = page.getByRole('heading', { name: 'The file for this book is missing' });
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await openLibraryFromAnyRoute(page);
      await dismissLibraryOverlays(page);
    }
    await page.getByRole('button', { name: /Alice|Wonderland/i }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /^(start reading|continue reading)$/i }).click();
    await expect(page).toHaveURL(/\/read\//, { timeout: 120_000 });
    await dismissReaderInterstitials(page);
    if (await missingHeading.isVisible({ timeout: 4000 }).catch(() => false)) {
      await page.getByLabel('Back to library').first().click();
      await dismissLibraryOverlays(page);
      await page.waitForTimeout(1500 * (attempt + 1));
      continue;
    }
    await waitForFoliateBookTextLive(page, { min: 200, needle: 'Alice' });
    return;
  }
  throw new Error('Alice EPUB did not open for voice gate smoke');
}

test.describe('live voice clone gates (production build)', () => {
  test('Voice Studio has no Train on device; read-aloud has no My voice', async ({ page: fixturePage, context, playwright }, testInfo) => {
    test.skip(!live, 'Set PAGENEST_SMOKE_LIVE=1 (npm run smoke:live).');
    test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name));
    test.setTimeout(600_000);

    const project = testInfo.project.name;
    let page: Page = fixturePage;
    let liveBrowser: BrowserContext | undefined;
    if (live && host) {
      const profile = join(repoRoot, 'tests/test-results/live-profile', host, `${project}-voice-gate`);
      rmSync(profile, { recursive: true, force: true });
      mkdirSync(profile, { recursive: true });
      const browserType = project === 'release-smoke-webkit' ? webkit : chromium;
      liveBrowser = await browserType.launchPersistentContext(profile, {
        viewport: VIEW,
        baseURL: process.env.PAGENEST_BASE_URL,
        serviceWorkers: 'allow',
      });
      await primeSmokeHints(liveBrowser);
      await primeDeviceSpeechForLiveSmoke(liveBrowser);
      page = liveBrowser.pages()[0] ?? (await liveBrowser.newPage());
      await page.setViewportSize(VIEW);
    } else {
      await primeSmokeHints(context);
      await primeDeviceSpeechForLiveSmoke(context);
      await page.setViewportSize(VIEW);
    }

    const consoleErrors: string[] = [];
    attachReleaseSmokeConsoleGuard(page, consoleErrors);

    await page.goto('./');
    await skipOnboarding(page);
    await dismissLibraryOverlays(page);
    await waitForLiveAppReady(page);

    await gotoTab(page, 'Settings');
    await page.locator('#pn-set-voices').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: 'Voice Studio' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Train on device' })).toHaveCount(0);
    await snap(page, project, '01-voice-studio');

    await openAliceForNarration(page);
    await tapReaderZone(page, 'center').catch(() => undefined);
    await openReadAloudControls(page);
    await page.getByRole('button', { name: 'Choose voice' }).click();
    await expect(page.getByRole('button', { name: /My voice/i })).toHaveCount(0);
    await snap(page, project, '02-narration-voices');

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
    await liveBrowser?.close();
  });
});
