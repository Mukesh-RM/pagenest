import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import {
  dismissLibraryOverlays,
  gotoTab,
  primeSmokeHints,
  skipOnboarding,
  waitForIndexedDbReady,
  waitForServiceWorkerControl,
  waitForStorageBootstrap,
} from './support/app';
import { dismissReaderInterstitials, waitForFoliateBookTextLive } from './support/foliate-reader';
import { attachReleaseSmokeConsoleGuard } from './support/release-smoke-console';
import { openReadAloudControls } from './support/narration-live';
import { releaseSmokeViewport } from './support/release-smoke-viewport';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const live = process.env.PAGENEST_SMOKE_LIVE === '1';
const host = process.env.PAGENEST_SMOKE_LIVE_HOST ?? 'live';
const shotDir = join(repoRoot, 'docs/screens/release-smoke-live', host);

async function snap(page: Page, project: string, name: string): Promise<void> {
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, `${project}-voice-gate-${name}.png`), fullPage: true });
}

test.describe('live voice clone gates (production build)', () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    test.skip(!live, 'Set PAGENEST_SMOKE_LIVE=1 (npm run smoke:live).');
    test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name));
    await primeSmokeHints(context);
    if (testInfo.project.name.includes('webkit')) {
      await context.addInitScript(() => sessionStorage.setItem('pn_no_opfs', '1'));
    }
    await page.setViewportSize(releaseSmokeViewport(testInfo.project.name));
  });

  test('Voice Studio has no Train on device; read-aloud has no My voice', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const project = testInfo.project.name;
    const consoleErrors: string[] = [];
    attachReleaseSmokeConsoleGuard(page, consoleErrors);

    await page.goto('./');
    await skipOnboarding(page);
    await dismissLibraryOverlays(page);
    await waitForIndexedDbReady(page);

    await gotoTab(page, 'Settings');
    await page.locator('#pn-set-voices').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: 'Voice Studio' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Train on device' })).toHaveCount(0);
    await snap(page, project, '01-voice-studio');

    const home = testInfo.project.name.includes('webkit') ? './?pn_no_opfs=1' : './';
    const epub = readFileSync(join(repoRoot, 'src/features/reader/fixtures/alice.epub'));
    await gotoTab(page, 'Library');
    await page.goto(home);
    await dismissLibraryOverlays(page);
    await waitForServiceWorkerControl(page);
    await page.getByRole('button', { name: 'Add books' }).first().click();
    await page.getByTestId('pick-files').setInputFiles({
      name: 'alice.epub',
      mimeType: 'application/epub+zip',
      buffer: epub,
    });
    await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 8000 }).catch(() => undefined);
    await waitForStorageBootstrap(page);
    await page.getByRole('button', { name: /Alice|Wonderland/i }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /^(start reading|continue reading)$/i }).click();
    await expect(page).toHaveURL(/\/read\//, { timeout: 120_000 });
    await dismissReaderInterstitials(page);
    await waitForFoliateBookTextLive(page, { min: 200, needle: 'Alice', timeout: 120_000 });
    await openReadAloudControls(page);
    await page.getByRole('button', { name: 'Choose voice' }).click();
    await expect(page.getByRole('button', { name: /My voice/i })).toHaveCount(0);
    await snap(page, project, '02-narration-voices');

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });
});
