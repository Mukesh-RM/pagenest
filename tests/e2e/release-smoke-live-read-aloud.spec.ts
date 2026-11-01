import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { PIPER_DEFAULT_VOICE } from '../../../src/engines/tts/piper/voices';
import {
  dismissLibraryOverlays,
  primeSmokeHints,
  skipOnboarding,
  waitForIndexedDbReady,
  waitForServiceWorkerControl,
} from './support/app';
import { dismissReaderInterstitials, waitForFoliateBookText } from './support/foliate-reader';
import { openReadAloudControls, waitForReadAloudAudible } from './support/narration-live';

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
  await waitForFoliateBookText(page, { min: 200, needle: 'Alice', timeout: 120_000 });
}

test.describe('live read-aloud produces audible audio', () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    test.skip(!live, 'Set PAGENEST_SMOKE_LIVE=1 (npm run smoke:live).');
    test.skip(testInfo.project.name !== 'release-smoke-chromium', 'Pixel Chromium profile for read-aloud P0.');
    await primeSmokeHints(context);
    await page.setViewportSize(VIEW);
  });

  test(`default voice (${PIPER_DEFAULT_VOICE}): download progress and non-silent playback`, async ({ page }, testInfo) => {
    test.setTimeout(900_000);
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

    await page.getByRole('button', { name: 'Choose voice' }).click();
    await page.getByRole('button', { name: /Kristin \(US\)/i }).click();
    await snap(page, project, '02b-voice');

    const start = page.getByRole('button', { name: 'Start read aloud' });
    await start.click();

    await expect(page.getByRole('button', { name: /Downloading voice|Pause read aloud/i })).toBeVisible({
      timeout: 120_000,
    });
    await snap(page, project, '03-preparing');

    await waitForReadAloudAudible(page);
    await snap(page, project, '04-playing');

    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });
});
