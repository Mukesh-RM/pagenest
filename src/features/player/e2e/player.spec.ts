import { test, expect } from '@playwright/test';

test.describe('audiobook player harness', () => {
  test('loads dev fixture and opens full player', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: /welcome back|now playing/i })).toBeVisible({ timeout: 15_000 });
    const dialog = page.getByRole('dialog', { name: 'PageNest test tone' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('PageNest test tone')).toBeVisible();
    await dialog.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  });

  test('keyboard shortcut k toggles play/pause', async ({ page }) => {
    await page.goto('./');
    const dialog = page.getByRole('dialog', { name: 'PageNest test tone' });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await page.keyboard.press('k');
    await expect(dialog.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  });
});
