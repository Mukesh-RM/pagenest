import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { dismissLibraryOverlays, primeSmokeHints, skipOnboarding, waitForIndexedDbReady, waitForServiceWorkerControl } from './support/app';
import { attachReleaseSmokeConsoleGuard } from './support/release-smoke-console';
import { dismissReaderInterstitials, waitForFoliateBookTextLive } from './support/foliate-reader';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const live = process.env.PAGENEST_SMOKE_LIVE === '1';
const host = process.env.PAGENEST_SMOKE_LIVE_HOST ?? 'live';
const shotDir = join(repoRoot, 'docs/screens/release-smoke-live', host);
const fixtureDir = join(repoRoot, 'src/features/reader/fixtures');

const FORMATS = [
  { id: 'mobi', name: 'alice.mobi', mime: 'application/x-mobipocket-ebook', open: 'foliate' as const },
  { id: 'fb2', name: 'alice.fb2', mime: 'application/x-fictionbook+xml', open: 'foliate' as const },
  { id: 'docx', name: 'alice.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', open: 'foliate' as const },
  { id: 'txt', name: 'alice.txt', mime: 'text/plain', open: 'foliate' as const },
  { id: 'cbz', name: 'alice.cbz', mime: 'application/vnd.comicbook+zip', open: 'foliate' as const },
  { id: 'pdf', name: 'alice.pdf', mime: 'application/pdf', open: 'pdf' as const },
] as const;

async function snap(page: Page, project: string, id: string): Promise<void> {
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, `${project}-formats-${id}-open.png`), fullPage: true });
}

test.describe('live extra format imports', () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    test.skip(!live, 'Set PAGENEST_SMOKE_LIVE=1 (npm run smoke:live).');
    test.skip(!['release-smoke-chromium', 'release-smoke-webkit'].includes(testInfo.project.name));
    await primeSmokeHints(context);
    await page.setViewportSize({ width: 360, height: 740 });
  });

  for (const fmt of FORMATS) {
    test(`opens ${fmt.id} after import`, async ({ page }, testInfo) => {
      test.setTimeout(600_000);
      const errors: string[] = [];
      attachReleaseSmokeConsoleGuard(page, errors);
      const buffer = readFileSync(join(fixtureDir, fmt.name));

      await page.goto('./');
      await skipOnboarding(page);
      await dismissLibraryOverlays(page);
      await waitForIndexedDbReady(page);
      await waitForServiceWorkerControl(page);

      await page.getByRole('button', { name: 'Add books' }).first().click();
      await page.getByTestId('pick-files').setInputFiles({ name: fmt.name, mimeType: fmt.mime, buffer });
      await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 8000 }).catch(() => undefined);
      await expect(page.getByRole('button', { name: /Alice|Wonderland/i }).first()).toBeVisible({ timeout: 180_000 });
      await page.getByRole('button', { name: /Alice|Wonderland/i }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: /^(start reading|continue reading)$/i }).click();
      await expect(page).toHaveURL(/\/read\//, { timeout: 120_000 });
      await dismissReaderInterstitials(page);

      if (fmt.open === 'foliate') {
        await waitForFoliateBookTextLive(page, { min: 80, needle: 'Alice', timeout: 240_000 });
      } else {
        await page.locator('.pn-pdf-page[data-rendered="true"] canvas').first().waitFor({ state: 'visible', timeout: 120_000 });
      }
      await snap(page, testInfo.project.name, fmt.id);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
});
