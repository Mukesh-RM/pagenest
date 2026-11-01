import { test, expect } from '@playwright/test';
import { gotoTab, launch } from './support/app';

test.describe('Settings sync devices', () => {
  test('shows Sync devices with pairing code and export control', async ({ page }) => {
    await launch(page);
    await gotoTab(page, 'Settings');
    await expect(page.getByRole('heading', { name: 'Sync devices' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('sync-pairing-code')).toContainText(/[23456789A-Z]{6}/);
    await expect(page.getByRole('button', { name: 'Save sync file' })).toBeVisible();
    await page.screenshot({ path: '../docs/screens/sync/settings-sync-devices.png', fullPage: true });
  });
});
