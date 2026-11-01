import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import {
  dismissLibraryOverlays,
  primeSmokeHints,
  skipOnboarding,
  waitForIndexedDbReady,
  waitForServiceWorkerControl,
} from './support/app';
import { dismissReaderInterstitials, waitForFoliateBookTextLive } from './support/foliate-reader';
import { exerciseReadAloudControls, openReadAloudControls, primeDeviceSpeechForLiveSmoke, seedLegacyPiperNarrationSettings, waitForReadAloudAudible } from './support/narration-live';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const live = process.env.PAGENEST_SMOKE_LIVE === '1';
const host = process.env.PAGENEST_SMOKE_LIVE_HOST ?? 'live';
const shotDir = join(repoRoot, 'docs/screens/release-smoke-live', host);
const VIEW = { width: 360, height: 740 };

async function snap(page: Page, project: string, name: string): Promise<void> {
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, `${project}-read-aloud-${name}.png`), fullPage: true });
}

async function importAliceEpub(page: Page): Promise<void> {
  const epub = readFileSync(join(repoRoot, 'src/features/reader/fixtures/alice.epub'));
  await page.goto('./');
  await skipOnboarding(page);
  await dismissLibraryOverlays(page);
  await waitForIndexedDbReady(page);
  await waitForServiceWorkerControl(page);
  await page.getByRole('button', { name: 'Add books' }).first().click();
  await page.getByTestId('pick-files').setInputFiles({
    name: 'alice.epub',
    mimeType: 'application/epub+zip',
    buffer: epub,
  });
  await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 8000 }).catch(() => undefined);
  await expect(page.getByRole('button', { name: /Alice|Wonderland/i }).first()).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: /Alice|Wonderland/i }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /^(start reading|continue reading)$/i }).click();
  await expect(page).toHaveURL(/\/read\//, { timeout: 120_000 });
  await dismissReaderInterstitials(page);
  await waitForFoliateBookTextLive(page, { min: 200, needle: 'Alice' });
}

test.describe('live read-aloud produces audible audio', () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    test.skip(!live, 'Set PAGENEST_SMOKE_LIVE=1 (npm run smoke:live).');
    test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name));
    await primeSmokeHints(context);
    await primeDeviceSpeechForLiveSmoke(context);
    await page.setViewportSize(VIEW);
  });

  test('device voice: instant playback, play/pause, speed', async ({ page }, testInfo) => {
    test.setTimeout(600_000);
    const project = testInfo.project.name;
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    await importAliceEpub(page);
    await snap(page, project, '01-reader');

    await openReadAloudControls(page);
    await snap(page, project, '02-controls');

    await page.getByRole('button', { name: 'Start read aloud' }).click();
    await expect(page.getByRole('button', { name: /Downloading voice|Loading voice/i })).toHaveCount(0, {
      timeout: 5_000,
    });
    await expect(page.getByRole('button', { name: 'Pause read aloud' })).toBeVisible({ timeout: 30_000 });
    await snap(page, project, '03-playing');

    await waitForReadAloudAudible(page);
    await snap(page, project, '04-audible');

    await exerciseReadAloudControls(page);
    await snap(page, project, '05-controls');

    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });

  test('legacy Piper pref migrates to device voice (no HD download)', async ({ page }, testInfo) => {
    test.setTimeout(600_000);
    const project = testInfo.project.name;
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    await importAliceEpub(page);
    await seedLegacyPiperNarrationSettings(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissReaderInterstitials(page);
    await waitForFoliateBookTextLive(page, { min: 200, needle: 'Alice' });
    await snap(page, project, 'legacy-01-reader');

    await openReadAloudControls(page);
    await page.getByRole('button', { name: 'Start read aloud' }).click();
    await expect(page.getByRole('button', { name: /Downloading voice|Loading voice/i })).toHaveCount(0, {
      timeout: 5_000,
    });
    await expect(page.getByRole('button', { name: 'Pause read aloud' })).toBeVisible({ timeout: 30_000 });
    await waitForReadAloudAudible(page);
    await snap(page, project, 'legacy-02-audible');

    await expect(page.getByRole('alert')).toHaveCount(0);
    const joined = consoleErrors.join('\n');
    expect(joined).not.toMatch(/sid.*feeds/i);
    expect(consoleErrors, joined).toEqual([]);
  });
});
