import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test } from '@playwright/test';
import { dismissReaderInterstitials, waitForFoliateBookText } from './support/foliate-reader';
import { skipOnboarding, waitForIndexedDbReady } from './support/app';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const phase = process.env.PAGENEST_UPGRADE_PHASE;
const profileDir = process.env.PAGENEST_UPGRADE_PROFILE;

test.describe.configure({ mode: 'serial' });

test('cross-build library survives upgrade', async () => {
  test.skip(!phase || !profileDir, 'Run via tests/scripts/release-upgrade-smoke.mjs only.');
  test.setTimeout(300_000);

  const browser = await chromium.launchPersistentContext(profileDir!, {
    viewport: { width: 360, height: 740 },
    baseURL: process.env.PAGENEST_BASE_URL,
  });
  const page = browser.pages()[0] ?? (await browser.newPage());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  const epub = readFileSync(join(repoRoot, 'src/features/reader/fixtures/alice.epub'));

  if (phase === 'import') {
    await page.goto('./');
    await skipOnboarding(page);
    await waitForIndexedDbReady(page);
    await page.getByRole('button', { name: 'Add books' }).first().click();
    await page.getByTestId('pick-files').setInputFiles({
      name: 'alice.epub',
      mimeType: 'application/epub+zip',
      buffer: epub,
    });
    await expect(page.getByRole('button', { name: /Alice|Wonderland/i }).first()).toBeVisible({ timeout: 120_000 });
    await page.getByRole('button', { name: /Alice|Wonderland/i }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /^(read|continue|open|start)/i }).first().click();
    await expect(page).toHaveURL(/\/read\//, { timeout: 120_000 });
    await dismissReaderInterstitials(page);
    await waitForFoliateBookText(page, { min: 200, needle: 'Alice', timeout: 120_000 });
  } else {
    await page.goto('./');
    await skipOnboarding(page);
    await expect(page.getByRole('button', { name: /Alice|Wonderland/i }).first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: /Alice|Wonderland/i }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /^(read|continue|open|start)/i }).first().click();
    await expect(page).toHaveURL(/\/read\//, { timeout: 120_000 });
    await dismissReaderInterstitials(page);
    const text = await waitForFoliateBookText(page, { min: 200, needle: 'Alice', timeout: 120_000 });
    expect(text).toContain('Alice');
    await expect(page.getByText(/file for this book is missing/i)).toHaveCount(0);
  }

  expect(errors).toEqual([]);
  await browser.close();
});
