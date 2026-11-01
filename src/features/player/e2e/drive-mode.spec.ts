import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const listenHash = '#/listen/pn-review-seed-audiobook';
const outDir = join(process.cwd(), 'docs', 'screens', 'drive-mode');

test.describe('drive mode and sleep timer', () => {
  test.beforeAll(() => {
    mkdirSync(outDir, { recursive: true });
  });

  test('audiobook player exposes drive mode and expanded sleep presets', async ({ page }) => {
    await page.goto(`./index.html${listenHash}`);
    await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 15_000 });

    const drive = page.getByTestId('player-drive-mode');
    await expect(drive).toBeVisible();
    await page.screenshot({ path: join(outDir, 'player-drive-button-light.png'), fullPage: true });

    await drive.click();
    const dialog = page.getByTestId('drive-mode');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back 30 seconds' })).toBeVisible();
    await page.screenshot({ path: join(outDir, 'drive-mode-light.png') });
    await page.getByRole('button', { name: 'Exit' }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole('button', { name: /Sleep timer/i }).click();
    await expect(page.getByRole('button', { name: '10 min', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '10 min', exact: true }).click();
    await expect(page.getByRole('button', { name: /Sleep timer: 10 min/i })).toBeVisible();
    await page.screenshot({ path: join(outDir, 'sleep-10min-light.png'), fullPage: true });
  });

  test('drive mode stays usable at 200% text in landscape', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.addInitScript(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.goto(`./index.html${listenHash}`);
    await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('player-drive-mode').click();
    await expect(page.getByTestId('drive-mode')).toBeVisible();
    await page.screenshot({ path: join(outDir, 'drive-mode-landscape-200pct.png') });
  });
});
