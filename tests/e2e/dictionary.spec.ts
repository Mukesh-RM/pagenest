import { test, expect } from '@playwright/test';
import { launch, gotoTab } from './support/app';

async function openSampleInReader(page: import('@playwright/test').Page): Promise<void> {
  await gotoTab(page, 'Library');
  const add = page.getByRole('button', { name: 'Add the sample book' });
  await add.scrollIntoViewIfNeeded();
  await add.click({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/read\//, { timeout: 30_000 });
  await waitForReflowText(page);
}

async function waitForReflowText(page: import('@playwright/test').Page): Promise<void> {
  const deadline = Date.now() + 90_000;
  for (;;) {
    for (const frame of page.frames()) {
      if (frame === page.mainFrame() || !frame.url().startsWith('blob:')) continue;
      const len = await frame.evaluate(() => document.body?.innerText?.length ?? 0).catch(() => 0);
      if (len >= 200) return;
    }
    if (Date.now() > deadline) throw new Error('Book text did not render in the reader.');
    await page.waitForTimeout(50);
  }
}

async function selectAllBookText(page: import('@playwright/test').Page): Promise<void> {
  const frame = page.frames().find((f) => f.url().startsWith('blob:'));
  if (!frame) throw new Error('Reflow frame not found.');
  await frame.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.body);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  });
}

test.describe('Offline dictionary in reader', () => {
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

  test.skip('reader define popup after installing WordNet starter', async ({ page }) => {
    test.setTimeout(120_000);
    await launch(page);
    await gotoTab(page, 'Settings');
    await page.getByRole('heading', { name: /dictionary and translation/i }).waitFor({ timeout: 15_000 });
    const starterRow = page
      .getByText(/English definitions \(WordNet starter\)/i)
      .locator('xpath=ancestor::div[contains(@class,"pn-dict-settings__row")]');
    const starterBtn = starterRow.getByRole('button', { name: /^Download$/ });
    if (await starterBtn.isEnabled()) await starterBtn.click();
    await expect(starterRow.getByRole('button', { name: /^Installed$/i })).toBeVisible({ timeout: 30_000 });

    await openSampleInReader(page);
    await selectAllBookText(page);
    const defineBtn = page.getByRole('button', { name: /^Define$/i });
    await defineBtn.waitFor({ timeout: 10_000 });
    await defineBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: '../docs/screens/dictionary/reader-define-popup.png' });
  });

  test.skip('reader selection translate shows offline sentence (mock Bergamot)', async ({ page }) => {
    test.setTimeout(120_000);
    await launch(page);
    await gotoTab(page, 'Settings');
    await page.getByRole('heading', { name: /dictionary and translation/i }).waitFor({ timeout: 15_000 });
    const hiRow = page.getByText(/English ↔ Hindi/i).locator('xpath=ancestor::div[contains(@class,"pn-dict-settings__row")]');
    const hiBtn = hiRow.getByRole('button', { name: /^Download$/ });
    if (await hiBtn.isEnabled()) await hiBtn.click();
    await expect(hiRow.getByRole('button', { name: /^Installed$/i })).toBeVisible({ timeout: 30_000 });

    await openSampleInReader(page);
    await selectAllBookText(page);
    const translateBtn = page.getByRole('button', { name: /^Translate$/i });
    await translateBtn.waitFor({ timeout: 10_000 });
    await translateBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/\[offline\]/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: '../docs/screens/dictionary/reader-translate-sentence.png' });
  });
});
