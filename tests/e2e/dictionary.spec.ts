import { test, expect } from '@playwright/test';
import { launch, gotoTab } from './support/app';
import {
  installDictionaryStarterPacks,
  installHindiTranslationPack,
  openSampleBookInReader,
  dismissReaderInterstitials,
  selectPhraseInFoliate,
  tapWordInFoliate,
} from './support/foliate-reader';

test.describe('Offline dictionary in reader', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('pn.hint.ios-install-sheet', '1');
        localStorage.setItem('pn.hint.install-banner', '1');
      } catch {
        /* storage blocked */
      }
    });
  });

  test.describe('Settings packs', () => {
    test.describe.configure({ mode: 'serial' });

  test('settings show dictionary packs with download sizes', async ({ page }) => {
    await launch(page);
    await gotoTab(page, 'Settings');
    await page.getByRole('heading', { name: /dictionary and translation/i }).waitFor({ timeout: 15_000 });
    await expect(page.getByText(/English definitions \(WordNet full\)/i)).toBeVisible();
    await expect(page.getByText(/English ↔ Hindi/i)).toBeVisible();
    await expect(page.getByText(/English ↔ Spanish/i)).toBeVisible();
    await expect(page.getByText(/MB|KB/i).first()).toBeVisible();
    await page.screenshot({ path: '../docs/screens/dictionary/settings-packs.png', fullPage: true });
  });

  test('downloading the WordNet starter pack marks it installed', async ({ page }) => {
    await launch(page);
    await gotoTab(page, 'Settings');
    await page.getByRole('heading', { name: /dictionary and translation/i }).waitFor({ timeout: 15_000 });
    const download = page
      .getByText(/English definitions \(WordNet starter\)/i)
      .locator('xpath=ancestor::div[contains(@class,"pn-dict-settings__row")]')
      .getByRole('button', { name: /^Download$/ });
    if (await download.isEnabled()) await download.click();
    await expect(page.getByRole('button', { name: /^Installed$/i }).first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: '../docs/screens/dictionary/pack-installed.png', fullPage: true });
  });
  });

  test.describe('Reader dictionary UI', () => {
    test.describe.configure({ mode: 'serial' });

  test('reader tap-word define popup after installing WordNet starter', async ({ page }) => {
    test.setTimeout(240_000);
    await launch(page);
    await installDictionaryStarterPacks(page);
    await gotoTab(page, 'Library');
    await openSampleBookInReader(page);
    await dismissReaderInterstitials(page);
    await tapWordInFoliate(page, 'Rabbit');
    await expect(page.locator('.pn-dict-popup')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 2, name: /rabbit/i })).toBeVisible();
    await page.screenshot({ path: '../docs/screens/dictionary/reader-define-popup.png' });
  });

  test('reader selection translate shows offline sentence (mock Bergamot)', async ({ page }) => {
    test.setTimeout(240_000);
    await launch(page);
    await installDictionaryStarterPacks(page);
    await installHindiTranslationPack(page);
    await gotoTab(page, 'Library');
    await openSampleBookInReader(page);
    await dismissReaderInterstitials(page);
    await selectPhraseInFoliate(page, 'Peter Rabbit');
    await page.getByRole('toolbar', { name: 'Selected text' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /Translate selection/i }).evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\[offline\]/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: '../docs/screens/dictionary/reader-translate-sentence.png' });
  });
  });
});
