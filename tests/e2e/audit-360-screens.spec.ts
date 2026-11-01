import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chooseTheme, gotoTab, launch, skipOnboarding } from './support/app';
import { waitForFoliateBookText, dismissReaderInterstitials } from './support/foliate-reader';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(repoRoot, 'docs', 'screens', 'audit-360');
const VIEW = { width: 360, height: 740 };

test.describe('360px audit screenshots (real fixtures)', () => {
  test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

  async function shot(page: Page, name: string): Promise<void> {
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  }

  test('library, settings, reader, player', async ({ page }) => {
    await page.setViewportSize(VIEW);
    await launch(page);
    await chooseTheme(page, 'light');
    await gotoTab(page, 'Library');
    await shot(page, '01-library-light');
    await gotoTab(page, 'Settings');
    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible({ timeout: 60_000 });
    await shot(page, '02-settings-light');
    await page.getByRole('heading', { name: 'Privacy' }).scrollIntoViewIfNeeded();
    await shot(page, '05-settings-privacy-360');
    await gotoTab(page, 'Library');
    const buffer = readFileSync(join(repoRoot, 'src/features/reader/fixtures/alice.epub'));
    await page.getByRole('button', { name: 'Add books' }).first().click();
    await page.getByTestId('pick-files').setInputFiles({ name: 'alice.epub', mimeType: 'application/epub+zip', buffer });
    await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 5000 }).catch(() => undefined);
    await page.getByRole('button', { name: 'Got it' }).click({ timeout: 5000 }).catch(() => undefined);
    const card = page.getByRole('button', { name: /Alice|Wonderland/i }).first();
    await expect(card).toBeVisible({ timeout: 60_000 });
    const start = page.getByRole('dialog').getByRole('button', { name: /^(read|continue|open|start)/i }).first();
    if (!(await start.isVisible().catch(() => false))) await card.click();
    await start.click({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/read\//, { timeout: 90_000 });
    await dismissReaderInterstitials(page);
    await waitForFoliateBookText(page, { min: 100, timeout: 120_000 });
    await shot(page, '03-reader-epub-light');
    await page.getByRole('button', { name: 'Back to library' }).click();
    await expect(page.getByRole('heading', { name: /^library$/i })).toBeVisible();
  });

  test('seed audiobook player', async ({ page }) => {
    await page.setViewportSize(VIEW);
    await page.goto('./?pn_seed_audio=1');
    await skipOnboarding(page);
    await page.goto('./listen/pn-review-seed-audiobook?pn_seed_audio=1');
    await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 30_000 });
    await shot(page, '04-player-light');
  });
});
