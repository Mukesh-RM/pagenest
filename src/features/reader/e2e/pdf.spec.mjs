// PDF through the same reader screen (owner: Reader). Production build, production CSP.
// The books are seeded the way the Library stores them: stored format "pdf", deliberately odd file names.
import { expect, test } from '@playwright/test';
import { BOOKS } from './support/fixtures.mjs';
import { savedPosition, seedBook, settled, watchErrors } from './support/app.mjs';

/** Wait until at least one PDF page canvas has been drawn. */
async function firstPageDrawn(page, timeout = 30000) {
  await page.locator('.pn-pdf-page[data-rendered="true"] canvas').first().waitFor({ state: 'visible', timeout });
}

test('a PDF stored under the odd name "scan.txt" opens with the PDF engine and draws its first page', async ({ page }, info) => {
  const errors = watchErrors(page);
  const id = await seedBook(page, BOOKS.pdf);
  const t0 = Date.now();
  await page.goto(`/read/${id}`);
  await firstPageDrawn(page);
  console.log(`[${info.project.name}] small PDF to first drawn page: ${Date.now() - t0} ms`);
  await expect(page.getByRole('heading', { level: 1, name: BOOKS.pdf.title })).toBeVisible();
  await expect.poll(async () => (await page.locator('.pn-pdf-text').first().innerText()).length, { timeout: 10000 }).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('PDF: change an Aa setting, reload, same page', async ({ page }) => {
  const errors = watchErrors(page);
  const id = await seedBook(page, BOOKS.pdf);
  await page.goto(`/read/${id}`);
  await firstPageDrawn(page);
  await page.locator('.pn-live__host').focus();
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('ArrowRight');
    await settled(page, 400);
  }
  await page.getByRole('button', { name: 'Reading settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reading settings' });
  await dialog.getByRole('radio', { name: /Dark/ }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.pn-reader')).toHaveAttribute('data-theme', 'dark');
  await settled(page, 800);
  // ProgressService saves every 5 s; the reader flushes 0.7 s after the last move. Wait for that, as a reader pausing would.
  await settled(page, 1200);
  const label = await page.locator('.pn-reader__chapter').innerText();
  const scrub = await page.locator('.pn-scrubber__input').inputValue();
  expect(label).toBe('Page 3 of 30');
  await page.reload();
  await firstPageDrawn(page);
  await settled(page, 800);
  const after = await savedPosition(page, id);
  expect(after?.locator).toMatchObject({ kind: 'page', page: 3 });
  expect(await page.locator('.pn-reader__chapter').innerText()).toBe(label);
  expect(await page.locator('.pn-scrubber__input').inputValue()).toBe(scrub);
  await expect(page.locator('.pn-reader')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('a 50 MB scanned PDF opens fast and shows its first page', async ({ page }, info) => {
  const errors = watchErrors(page);
  const id = await seedBook(page, BOOKS.large);
  const t0 = Date.now();
  await page.goto(`/read/${id}`);
  await firstPageDrawn(page, 60000);
  const ms = Date.now() - t0;
  console.log(`[${info.project.name}] 50 MB PDF to first drawn page: ${ms} ms`);
  await expect(page.locator('.pn-live__state')).toHaveCount(0, { timeout: 3000 });
  expect(ms).toBeLessThan(3000);
  expect(errors).toEqual([]);
});
