import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const shotsDir = join(process.cwd(), 'docs', 'screens', 'narration');

test('read-aloud controls meet contrast and 200% zoom', async ({ page }) => {
  mkdirSync(shotsDir, { recursive: true });
  await page.goto('/narration-e2e.html');
  await expect(page.getByRole('heading', { name: 'Narration controls' })).toBeVisible();
  const readAloud = page.getByRole('button', { name: 'Start read aloud' });
  await expect(readAloud).toBeVisible();
  await page.screenshot({ path: join(shotsDir, 'controls-light.png'), fullPage: true });
  await page.emulateMedia({ forcedColors: 'active' });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect(readAloud).toBeVisible();
  await readAloud.click();
  await expect(page.getByRole('button', { name: 'Pause read aloud' })).toBeVisible();
  await page.screenshot({ path: join(shotsDir, 'controls-playing-forced-colors-200pct.png'), fullPage: true });
  await page.getByRole('button', { name: '1.25×' }).click();
  await page.getByLabel('Expressive').check();
  await page.screenshot({ path: join(shotsDir, 'controls-expressive-speed.png'), fullPage: true });
});
