import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { OK_PIPER_VOICES } from '../../../src/engines/tts/piper/voices';
import {
  dismissLibraryOverlays,
  primeSmokeHints,
  skipOnboarding,
  waitForIndexedDbReady,
  waitForServiceWorkerControl,
} from './support/app';
import { dismissReaderInterstitials, waitForFoliateBookText } from './support/foliate-reader';
import {
  exerciseNarrationControls,
  expectNarrationSurvivesBackground,
  openReadAloudControls,
  pickNarrationVoice,
  waitForNarrationAudible,
} from './support/narration-live';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const live = process.env.PAGENEST_SMOKE_LIVE === '1';
const host = process.env.PAGENEST_SMOKE_LIVE_HOST ?? 'live';
const shotDir = join(repoRoot, 'docs/screens/release-smoke-live', host);
const VIEW = { width: 360, height: 740 };

function slug(s: string): string {
  return s.replace(/[^\w.-]+/g, '-').toLowerCase();
}

async function snap(page: Page, project: string, name: string): Promise<void> {
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, `${project}-narration-${slug(name)}.png`), fullPage: true });
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

test.describe.configure({ mode: 'serial' });

test.describe('live read-aloud: five offline Piper voices', () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    test.skip(!live, 'Set PAGENEST_SMOKE_LIVE=1 (npm run smoke:live).');
    test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name));
    await primeSmokeHints(context);
    await page.setViewportSize(VIEW);
  });

  for (const voice of OK_PIPER_VOICES) {
    test(`${voice.name}: download, play, controls, background`, async ({ page, context }, testInfo) => {
      test.setTimeout(900_000);
      const project = testInfo.project.name;
      const consoleErrors: string[] = [];
      page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
      });

      await importAliceEpub(page);
      await snap(page, project, `${slug(voice.name)}-01-reader`);

      await openReadAloudControls(page);
      await snap(page, project, `${slug(voice.name)}-02-controls`);

      await pickNarrationVoice(page, voice.name);
      await snap(page, project, `${slug(voice.name)}-03-voice-picked`);

      await waitForNarrationAudible(page);
      await snap(page, project, `${slug(voice.name)}-04-playing`);

      await exerciseNarrationControls(page);
      await snap(page, project, `${slug(voice.name)}-05-controls-exercised`);

      await expectNarrationSurvivesBackground(page, context);
      await snap(page, project, `${slug(voice.name)}-06-background`);

      expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
    });
  }
});
