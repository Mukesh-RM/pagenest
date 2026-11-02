import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { dismissLibraryOverlays, gotoTab, primeSmokeHints, skipOnboarding, waitForIndexedDbReady, waitForServiceWorkerControl } from './support/app';
import { attachReleaseSmokeConsoleGuard } from './support/release-smoke-console';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const live = process.env.PAGENEST_SMOKE_LIVE === '1';
const host = process.env.PAGENEST_SMOKE_LIVE_HOST ?? 'live';
const shotDir = join(repoRoot, 'docs/screens/release-smoke-live', host);

test.describe('live backup and restore', () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    test.skip(!live, 'Set PAGENEST_SMOKE_LIVE=1 (npm run smoke:live).');
    test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name));
    await primeSmokeHints(context);
    await page.setViewportSize({ width: 360, height: 740 });
  });

  test('save backup then restore after re-import', async ({ page }, testInfo) => {
    test.setTimeout(600_000);
    const errors: string[] = [];
    attachReleaseSmokeConsoleGuard(page, errors);
    const epub = await import('node:fs').then((fs) =>
      fs.readFileSync(join(repoRoot, 'src/features/reader/fixtures/alice.epub')),
    );

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
    await expect(page.getByRole('button', { name: /Alice|Wonderland/i }).first()).toBeVisible({ timeout: 120_000 });

    await gotoTab(page, 'Settings');
    mkdirSync(shotDir, { recursive: true });
    await page.screenshot({ path: join(shotDir, `${testInfo.project.name}-backup-01-settings.png`), fullPage: true });

    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
    await page.getByRole('button', { name: 'Save a backup' }).click();
    const download = await downloadPromise;
    const backupPath = join(repoRoot, 'tests/test-results', `backup-${testInfo.project.name}.zip`);
    await download.saveAs(backupPath);

    await page.getByTestId('restore-file').setInputFiles(backupPath);
    await expect(page.getByText(/Restored .* book/i)).toBeVisible({ timeout: 180_000 });
    await page.screenshot({ path: join(shotDir, `${testInfo.project.name}-backup-02-restored.png`), fullPage: true });

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
