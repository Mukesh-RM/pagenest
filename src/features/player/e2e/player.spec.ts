import { test, expect } from '@playwright/test';

test.describe('audiobook player harness', () => {
  test('loads dev fixture and opens full player', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /welcome back|now playing/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('PageNest test tone')).toBeVisible();
  });

  test('space toggles play without focusing inputs', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play' }).click();
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  });
});
