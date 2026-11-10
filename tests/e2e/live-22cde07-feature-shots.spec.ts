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
import { attachReleaseSmokeConsoleGuard } from './support/release-smoke-console';
import { dismissReaderInterstitials, selectPhraseInFoliate, waitForFoliateBookTextLive } from './support/foliate-reader';
import { releaseSmokeViewport } from './support/release-smoke-viewport';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const shotDir = join(repoRoot, 'docs/screens/live-22cde07');

async function snap(page: Page, project: string, name: string): Promise<void> {
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, `${project}-${name}.png`), fullPage: true });
}

async function importAlice(page: Page, home = './'): Promise<void> {
  const epub = readFileSync(join(repoRoot, 'src/features/reader/fixtures/alice.epub'));
  await page.goto(home);
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
  await waitForStorageBootstrap(page);
  await expect(page.getByRole('button', { name: /Alice|Wonderland/i }).first()).toBeVisible({ timeout: 120_000 });
}

async function simulatePullToRefresh(page: Page, project: string): Promise<void> {
  const box = await page.locator('.pn-ptr').boundingBox();
  if (!box) throw new Error('Pull-to-refresh root missing');
  const x = Math.round(box.x + box.width / 2);
  const y0 = Math.round(box.y + 50);
  const y1 = y0 + 160;
  if (project.includes('chromium')) {
    const client = await page.context().newCDPSession(page);
    const point = (y: number) => [{ x, y, radiusX: 1, radiusY: 1, force: 1, id: 0 }];
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(y0) });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(y1) });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return;
  }
  await page.mouse.move(x, y0);
  await page.mouse.down();
  await page.mouse.move(x, y1, { steps: 10 });
}

test.describe('live 22cde07 feature screenshots', () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    test.skip(process.env.PAGENEST_SMOKE_LIVE !== '1', 'Live URL required.');
    test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name));
    await primeSmokeHints(context);
    if (testInfo.project.name.includes('webkit')) {
      await context.addInitScript(() => sessionStorage.setItem('pn_no_opfs', '1'));
    }
    await page.setViewportSize(releaseSmokeViewport(testInfo.project.name));
  });

  test('parity UI: pull-to-refresh, detail tabs, comfort, search, drive, sync, dictionary', async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    const project = testInfo.project.name;
    const home = project.includes('webkit') ? './?pn_no_opfs=1' : './';
    const errors: string[] = [];
    attachReleaseSmokeConsoleGuard(page, errors);

    await importAlice(page, home);

    await page.evaluate(() => window.scrollTo(0, 0));
    await simulatePullToRefresh(page, project);
    const pullLabel = page.getByText(/pull to refresh|release to refresh/i);
    if (project.includes('chromium')) {
      await expect(pullLabel).toBeVisible({ timeout: 5000 });
    }
    await snap(page, project, '01-pull-to-refresh');
    if (!project.includes('chromium')) await page.mouse.up();

    await page.getByRole('button', { name: /Alice|Wonderland/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await snap(page, project, '02-detail-info-tab');
    await snap(page, project, '02b-detail-tabs-chips');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });
    await page.getByRole('button', { name: /Alice|Wonderland/i }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /^(start reading|continue reading)$/i }).click();
    await expect(page).toHaveURL(/\/read\//, { timeout: 120_000 });
    await dismissReaderInterstitials(page);
    await waitForFoliateBookTextLive(page, { min: 200, needle: 'Alice', timeout: 120_000 });
    await page.getByRole('button', { name: 'Contents' }).click();
    await expect(page.getByRole('dialog', { name: 'Contents' })).toBeVisible({ timeout: 15_000 });
    await snap(page, project, '03-detail-chapters-contents');
    await page.keyboard.press('Escape');

    const stage = page.locator('.pn-live__stage');
    const box = await stage.boundingBox();
    if (!box) throw new Error('Reader stage missing');
    await page.evaluate(
      async ([brightness, warmth]) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open('pagenest');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => resolve(req.result);
        });
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('settings', 'readwrite');
          tx.objectStore('settings').put({ key: 'readerComfort', value: { brightness, warmth } });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      },
      [0.55, 0.65] as const,
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissReaderInterstitials(page);
    await waitForFoliateBookTextLive(page, { min: 200, needle: 'Alice', timeout: 120_000 });
    await snap(page, project, '04-reader-comfort-warm-dim');

    await page.getByRole('button', { name: 'Search in this book' }).click();
    const searchSheet = page.getByRole('dialog', { name: 'Search in this book' });
    await searchSheet.locator('#pn-live-search-q').fill('rabbit');
    await searchSheet.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Search results' })).toBeVisible({ timeout: 60_000 });
    await snap(page, project, '05-in-book-search');

    await page.keyboard.press('Escape');
    await selectPhraseInFoliate(page, 'Alice');
    await page.getByRole('button', { name: 'Define selection' }).click({ timeout: 30_000 });
    await expect(page.getByRole('dialog', { name: /definition of/i })).toBeVisible({ timeout: 30_000 });
    await snap(page, project, '06-dictionary-popup');

    await page.goto(home);
    await dismissLibraryOverlays(page);
    const mp3 = readFileSync(join(repoRoot, 'src/features/library/e2e/audio-fixtures/tone-book.mp3'));
    await page.getByRole('button', { name: 'Add books' }).first().click();
    await page.getByTestId('pick-files').setInputFiles([{ name: 'tones.mp3', mimeType: 'audio/mpeg', buffer: mp3 }]);
    await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 8000 }).catch(() => undefined);
    await expect(page.getByRole('button', { name: 'Tone Book' }).first()).toBeVisible({ timeout: 120_000 });
    await page.getByRole('button', { name: 'Tone Book' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Listen', exact: true }).click();
    await expect(page).toHaveURL(/\/listen\//, { timeout: 60_000 });
    await page.getByTestId('player-drive-mode').click();
    await expect(page.getByTestId('drive-mode')).toBeVisible({ timeout: 15_000 });
    await snap(page, project, '07-drive-mode');
    await page.getByTestId('drive-mode').getByRole('button', { name: 'Exit' }).click();
    await expect(page.getByTestId('drive-mode')).toBeHidden({ timeout: 15_000 });

    await page.goto(home);
    await dismissLibraryOverlays(page);
    await gotoTab(page, 'Settings');
    await expect(page.getByRole('heading', { name: 'Sync devices' })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('heading', { name: 'Sync devices' }).scrollIntoViewIfNeeded();
    await snap(page, project, '08-device-sync');

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
