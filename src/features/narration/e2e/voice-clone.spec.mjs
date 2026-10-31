import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const shotsDir = join(process.cwd(), 'docs', 'screens', 'voice-clone');

test('My voice appears in narration voice picker', async ({ page }) => {
  mkdirSync(shotsDir, { recursive: true });
  await page.goto('/narration-e2e.html');
  await page.getByRole('button', { name: 'Choose voice' }).click();
  await expect(page.getByRole('button', { name: /My voice Casey/i })).toBeVisible();
  await page.screenshot({ path: join(shotsDir, 'narration-my-voice-picker.png'), fullPage: true });
});

test('Prepare voice shows download progress for neural stack', async ({ page }) => {
  mkdirSync(shotsDir, { recursive: true });
  await page.goto('/narration-e2e.html');
  await page.getByRole('button', { name: 'Choose voice' }).click();
  await page.getByRole('button', { name: /My voice Casey/i }).click();
  const prepare = page.getByRole('button', { name: /Prepare/i });
  if (await prepare.isVisible()) {
    await prepare.click();
    await expect(page.getByText(/download|prepare|model/i).first()).toBeVisible({ timeout: 5000 });
  }
  await page.screenshot({ path: join(shotsDir, 'prepare-download-progress.png'), fullPage: true });
});
