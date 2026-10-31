import { expect, test } from '@playwright/test';
import { openSampleFromFirstLaunch, waitForBookText } from './support/app.mjs';

test('in-book search finds Peter and jumps to a result', async ({ page }) => {
  await openSampleFromFirstLaunch(page);
  await waitForBookText(page, { min: 100 });
  await page.getByRole('button', { name: 'Search in this book' }).click();
  const dialog = page.getByRole('dialog', { name: 'Search in this book' });
  await dialog.getByRole('searchbox', { name: 'Search in this book' }).fill('peter');
  await dialog.getByRole('button', { name: 'Search' }).click();
  const results = dialog.getByRole('list', { name: 'Search results' });
  await expect(results.getByRole('button').first()).toBeVisible({ timeout: 20000 });
  await results.getByRole('button').first().click();
  await expect(dialog).toBeHidden();
  const text = await waitForBookText(page, { min: 20 });
  expect(text.toLowerCase()).toMatch(/peter|rabbit/);
});

test('bookmark persists after reload', async ({ page }) => {
  await openSampleFromFirstLaunch(page);
  await waitForBookText(page, { min: 100 });
  await page.getByRole('button', { name: 'Add bookmark here' }).click();
  await expect
    .poll(async () => {
      return page.evaluate(async () => {
        const dbs = await indexedDB.databases();
        const name = dbs.find((d) => d.name?.startsWith('pagenest'))?.name;
        if (!name) return 0;
        return new Promise((resolve) => {
          const req = indexedDB.open(name);
          req.onsuccess = () => {
            const tx = req.result.transaction('bookmarks', 'readonly');
            const store = tx.objectStore('bookmarks');
            const count = store.count();
            count.onsuccess = () => resolve(count.result);
          };
        });
      });
    })
    .toBeGreaterThan(0);
  await page.reload();
  await waitForBookText(page, { min: 50 });
  await page.getByRole('button', { name: 'Bookmarks and highlights' }).click();
  const sheet = page.getByRole('dialog', { name: 'Marks in this book' });
  await sheet.getByRole('tab', { name: 'Bookmarks' }).click();
  await expect(sheet.getByRole('tabpanel', { name: 'Bookmarks' }).getByRole('button')).toBeVisible();
});
