import { test, expect } from '@playwright/test';

const listenHash = '#/listen/dev-fixture-audio';

test.describe('audiobook player harness', () => {
  test('immersive listen route shows full player and keeps controls', async ({ page }) => {
    await page.goto(`./index.html${listenHash}`);
    await expect(page.getByRole('heading', { name: /now playing/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect(page.getByText(/chapter-one|PageNest test tone/i)).toBeVisible();
  });

  test('mini-player slot hides on immersive route and returns on library', async ({ page }) => {
    await page.goto(`./index.html${listenHash}`);
    await expect(page.getByRole('heading', { name: /now playing/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: 'Mini player' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to Library' }).click();
    await expect(page.getByRole('region', { name: 'Mini player' })).toBeVisible();
  });

  test('keyboard shortcut k toggles play/pause on immersive player', async ({ page }) => {
    await page.goto(`./index.html${listenHash}`);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await page.keyboard.press('k');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  });
});
