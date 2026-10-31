import { test, expect, type Page } from '@playwright/test';

async function recordFullVoice(page: Page) {
  await page.goto('./index.html');
  await page.getByRole('button', { name: 'Record my voice' }).click();
  await page.getByRole('button', { name: 'I am ready' }).click();
  await page.getByRole('button', { name: 'Start reading the phrase' }).click();
  await page.getByRole('button', { name: 'Stop and verify' }).click();
  await expect(page.getByText('Phrase verified')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Continue' }).click();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Record this line' }).click();
    await page.getByRole('button', { name: 'Stop recording' }).click();
  }
  await page.getByLabel('Voice name').fill('Studio e2e');
  await page.getByRole('button', { name: 'Save to this device' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Studio e2e')).toBeVisible({ timeout: 15_000 });
}

test.describe('Voice Studio', () => {
  test('records with mock mic, verifies consent, saves and exports', async ({ page }) => {
    await recordFullVoice(page);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export pack' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/voice-pack\.zip$/);
  });

  test('delete removes a saved voice', async ({ page }) => {
    await recordFullVoice(page);
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('No personal voices yet')).toBeVisible();
  });
});
