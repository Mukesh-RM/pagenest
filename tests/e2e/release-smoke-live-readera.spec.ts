import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  dismissLibraryOverlays,
  gotoTab,
  longPress,
  primeSmokeHints,
  skipOnboarding,
  waitForIndexedDbReady,
  waitForServiceWorkerControl,
} from './support/app';
import { attachReleaseSmokeConsoleGuard } from './support/release-smoke-console';
import { dismissReaderInterstitials, selectPhraseInFoliate, waitForFoliateBookTextLive } from './support/foliate-reader';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const live = process.env.PAGENEST_SMOKE_LIVE === '1';
const host = process.env.PAGENEST_SMOKE_LIVE_HOST ?? 'live';
const shotDir = join(repoRoot, 'docs/screens/release-smoke-live', host);
const VIEW = { width: 360, height: 740 };

async function snap(page: Page, project: string, name: string): Promise<void> {
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, `${project}-readera-${name}.png`), fullPage: true });
}

async function importAlice(page: Page): Promise<void> {
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
}

test.describe('live ReadEra parity screenshots', () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    test.skip(!live, 'Set PAGENEST_SMOKE_LIVE=1 (npm run smoke:live).');
    test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name));
    await primeSmokeHints(context);
    await page.setViewportSize(VIEW);
  });

  test('format chips, detail read aloud, copy/note, collection collage', async ({ page }, testInfo) => {
    test.setTimeout(600_000);
    const project = testInfo.project.name;
    const errors: string[] = [];
    attachReleaseSmokeConsoleGuard(page, errors);

    await importAlice(page);
    await expect(page.locator('.pn-bookcard__format').first()).toHaveText('EPUB');
    await snap(page, project, '01-format-chips');

    const card = page.getByRole('button', { name: /Alice|Wonderland/i }).first();
    await card.click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Read aloud' })).toBeVisible();
    await snap(page, project, '02-detail-read-aloud');

    await page.getByRole('dialog').getByRole('button', { name: /^(start reading|continue reading)$/i }).click();
    await expect(page).toHaveURL(/\/read\//, { timeout: 120_000 });
    await dismissReaderInterstitials(page);
    await waitForFoliateBookTextLive(page, { min: 200, needle: 'Alice' });
    await selectPhraseInFoliate(page, 'Alice');
    await expect(page.getByRole('button', { name: 'Copy selection' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add note to selection' })).toBeVisible();
    await snap(page, project, '03-selection-copy-note');

    await page.goto('./');
    await dismissLibraryOverlays(page);
    const libraryCard = page.getByRole('button', { name: /Alice|Wonderland/i }).first();
    await longPress(libraryCard);
    await expect(page.getByRole('toolbar', { name: 'Actions for selected books' })).toBeVisible();
    await page.getByRole('button', { name: 'Add to a collection' }).click();
    await page.getByRole('dialog', { name: 'Add to a collection' }).getByLabel('New collection').fill('Live smoke shelf');
    await page.getByRole('button', { name: 'Make it and add' }).click();
    await gotoTab(page, 'Collections');
    await expect(page.locator('.pn-shelf__cover').first()).toBeVisible({ timeout: 30_000 });
    await snap(page, project, '04-collection-collage');

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
