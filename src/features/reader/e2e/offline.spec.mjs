// Offline reading (owner: Reader). Production build, production CSP, a fresh browser profile per test.
// The engines are not precached (Decision 15): the idle warm-up stores them in the service worker's pn-engines-v1 cache.
// These tests never reload "to get the service worker going" before the network is cut: the first visit's idle warm-up must be enough.
import { expect, test } from '@playwright/test';
import { BOOKS } from './support/fixtures.mjs';
import { seedBook, settled, waitForBookText, watchErrors } from './support/app.mjs';

const WARM_SETTLE_MS = 45000; // the warm-up starts ~5 s after the Library is drawn, then downloads about 1.5 MB

/** File names (paths) in the engine cache. */
async function engineCache(page) {
  return page.evaluate(async () => {
    if (!(await caches.has('pn-engines-v1'))) return [];
    const cache = await caches.open('pn-engines-v1');
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });
}

/** Wait for the first-visit warm-up to have stored every named file; resolves with how long it took. */
async function waitForWarmUp(page, patterns) {
  const t0 = Date.now();
  await expect
    .poll(async () => {
      const files = await engineCache(page);
      return patterns.filter((p) => !files.some((f) => p.test(f))).map(String);
    }, { timeout: WARM_SETTLE_MS, intervals: [500] })
    .toEqual([]);
  return Date.now() - t0;
}

async function firstPageDrawn(page, timeout = 30000) {
  await page.locator('.pn-pdf-page[data-rendered="true"] canvas').first().waitFor({ state: 'visible', timeout });
}

// (the small epub-engine and pdf-engine wrappers are precached; the big library chunks, the worker and the sample are runtime-cached)
const EPUB_FILES = [/\/engine-foliate-[^/]+\.js$/, /\/peter-rabbit-[^/]+\.epub$/];
const PDF_FILES = [/\/engine-pdf-[^/]+\.js$/, /\/pdf\.worker\.min-[^/]+\.mjs$/];

test('first visit, wait for idle, go offline, open the sample book: text shows (no reload first)', async ({ page, context }, info) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('button', { name: 'Add the sample book' })).toBeVisible();
  const warmMs = await waitForWarmUp(page, EPUB_FILES);
  console.log(`[${info.project.name}] first visit: EPUB engine and sample book in the offline cache after ${warmMs} ms`);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Add the sample book' }).click();
  await expect(page).toHaveURL(/\/read\//);
  const text = await waitForBookText(page, { min: 100 });
  expect(text).toMatch(/Peter|Rabbit/i);
  expect(errors.filter((e) => !/Failed to load resource|net::ERR_INTERNET_DISCONNECTED/.test(e))).toEqual([]);
});

test('first visit, wait for idle, go offline, reload the app: the sample book still opens and reads', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Add the sample book' }).click();
  await waitForBookText(page, { min: 100 });
  await page.goBack();
  await waitForWarmUp(page, EPUB_FILES);
  await context.setOffline(true);
  await page.goto('/');
  await page.getByRole('link', { name: /Peter Rabbit/ }).or(page.getByText(/Peter Rabbit/).first()).first().click();
  const text = await waitForBookText(page, { min: 100 });
  expect(text).toMatch(/Peter|Rabbit/i);
});

test('PDF: open it, go offline, reload, and read pages', async ({ page, context }, info) => {
  const errors = watchErrors(page);
  const id = await seedBook(page, BOOKS.pdf); // the first visit; the Library stays on screen while it idles
  const warmMs = await waitForWarmUp(page, [...PDF_FILES, ...EPUB_FILES]);
  console.log(`[${info.project.name}] first visit: PDF engine, worker and EPUB engine in the offline cache after ${warmMs} ms`);
  await context.setOffline(true);
  await page.goto(`/read/${id}`); // a navigation with no network: the app shell and the engine come from the worker's caches
  await firstPageDrawn(page);
  await expect.poll(async () => (await page.locator('.pn-pdf-text').first().innerText()).length, { timeout: 10000 }).toBeGreaterThan(20);
  await page.locator('.pn-live__host').focus();
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('ArrowRight');
    await settled(page, 400);
  }
  await expect(page.locator('.pn-reader__chapter')).toHaveText('Page 3 of 30');
  await expect.poll(async () => (await page.locator('.pn-pdf-page[data-rendered="true"] .pn-pdf-text').last().innerText()).length, { timeout: 10000 }).toBeGreaterThan(20);
  await settled(page, 1500); // the spot is saved once the reader stops moving
  await page.reload();
  await firstPageDrawn(page);
  await expect(page.locator('.pn-reader__chapter')).toHaveText('Page 3 of 30');
  expect(errors.filter((e) => !/Failed to load resource|net::ERR_INTERNET_DISCONNECTED/.test(e))).toEqual([]);
});
