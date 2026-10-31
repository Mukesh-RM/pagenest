import { test, expect } from '@playwright/test';
import { launch, gotoTab } from './support/app';

test.describe('Offline dictionary in reader', () => {
  test('settings show dictionary packs with download sizes', async ({ page }) => {
    await launch(page);
    await gotoTab(page, 'Settings');
    await page.getByRole('heading', { name: /dictionary and translation/i }).waitFor({ timeout: 15_000 });
    await expect(page.getByText(/English definitions \(WordNet core\)/i)).toBeVisible();
    await expect(page.getByText(/English ↔ Hindi/i)).toBeVisible();
    await expect(page.getByText(/KB/i).first()).toBeVisible();
    await page.screenshot({ path: '../docs/screens/dictionary/settings-packs.png', fullPage: true });
  });

  test('downloading the WordNet pack marks it installed', async ({ page }) => {
    await launch(page);
    await gotoTab(page, 'Settings');
    await page.getByRole('heading', { name: /dictionary and translation/i }).waitFor({ timeout: 15_000 });
    const download = page
      .getByText(/English definitions \(WordNet core\)/i)
      .locator('xpath=ancestor::div[contains(@class,"pn-dict-settings__row")]')
      .getByRole('button', { name: /^Download$/ });
    if (await download.isEnabled()) await download.click();
    await expect(page.getByRole('button', { name: /^Installed$/i }).first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: '../docs/screens/dictionary/pack-installed.png', fullPage: true });
  });
});
