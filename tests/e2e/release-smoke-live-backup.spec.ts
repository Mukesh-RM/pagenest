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
} from './support/app';
import { attachReleaseSmokeConsoleGuard } from './support/release-smoke-console';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const live = process.env.PAGENEST_SMOKE_LIVE === '1';
const host = process.env.PAGENEST_SMOKE_LIVE_HOST ?? 'live';
const shotDir = join(repoRoot, 'docs/screens/release-smoke-live', host);
const VIEW = { width: 360, height: 740 };

async function snap(page: Page, project: string, name: string): Promise<void> {
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, `${project}-backup-${name}.png`), fullPage: true });
}

async function clearLibraryRows(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const open = indexedDB.open('pagenest');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const names = [...db.objectStoreNames];
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(names, 'readwrite');
      for (const name of names) tx.objectStore(name).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
}

test.describe('live backup and restore', () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    test.skip(!live, 'Set PAGENEST_SMOKE_LIVE=1 (npm run smoke:live).');
    test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name));
    await context.addInitScript(() => {
      try {
        delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
      } catch {
        /* ignore */
      }
    });
    await primeSmokeHints(context);
    await page.setViewportSize(VIEW);
  });

  test('save backup download then restore library', async ({ page }, testInfo) => {
    test.setTimeout(600_000);
    const project = testInfo.project.name;
    const errors: string[] = [];
    attachReleaseSmokeConsoleGuard(page, errors);

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

    await gotoTab(page, 'Settings');
    await page.getByRole('heading', { name: 'Backup and restore' }).scrollIntoViewIfNeeded();
    await snap(page, project, '01-settings');

    const downloadPromise = page.waitForEvent('download', { timeout: 180_000 });
    await page.getByRole('button', { name: 'Save a backup' }).click();
    const download = await downloadPromise;
    const backupPath = await download.path();
    expect(backupPath).toBeTruthy();
    const backupBytes = readFileSync(backupPath!);
    expect(backupBytes.byteLength).toBeGreaterThan(500);
    await expect(page.getByText(/Backup saved/i)).toBeVisible({ timeout: 120_000 });

    await clearLibraryRows(page);
    await page.reload();
    await skipOnboarding(page);
    await dismissLibraryOverlays(page);
    await waitForIndexedDbReady(page);
    await expect(page.getByRole('button', { name: /Alice|Wonderland/i })).toHaveCount(0, { timeout: 30_000 });

    await gotoTab(page, 'Settings');
    await page.getByTestId('restore-file').setInputFiles({
      name: 'InkQuiet-backup.zip',
      mimeType: 'application/zip',
      buffer: backupBytes,
    });
    await expect(page.getByText(/Restored .*book/i)).toBeVisible({ timeout: 180_000 });

    await gotoTab(page, 'Library');
    await expect(page.getByRole('button', { name: /Alice|Wonderland/i }).first()).toBeVisible({ timeout: 60_000 });
    await snap(page, project, '02-restored');

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
