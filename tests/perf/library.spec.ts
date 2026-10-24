import { expect, test, type Page } from '@playwright/test';
import { launch } from '../e2e/support/app';
import { bookCards, filterChip, searchField, seedLibrary, SEED } from '../e2e/support/library';
import { flingScroll, longTasks, measureInput, recordLongTasks, throttleCpu } from '../e2e/support/perf';
import { BUDGETS } from './budgets';

// Large-library gates (brief: at least 1,000 books; blueprint 16: 5,000 books must scroll at 60 fps).
// Books are seeded straight into IndexedDB through the blueprint 13 contract (e2e/support/library.ts).
// Owner of failures here: Library (src/features/library), with UI/UX for the screen chrome.

async function openSeededLibrary(page: Page, count: number): Promise<void> {
  await recordLongTasks(page);
  await launch(page); // creates the database
  await seedLibrary(page, { count }); // writes the books and reloads
  await throttleCpu(page, BUDGETS.tap.cpuThrottle);
}

const FIRST_CARDS = 30;
const allCardsMatch = (pattern: string) =>
  `(() => { const c = [...document.querySelectorAll('main li')].slice(0, ${FIRST_CARDS}); return c.length > 0 && c.every((e) => /${pattern}/.test(e.textContent ?? '')); })()`;

test(`a ${BUDGETS.library.sizeForOpenAndSearch}-book library opens in ${BUDGETS.library.openMs} ms without a long task`, async ({ page }) => {
  await openSeededLibrary(page, BUDGETS.library.sizeForOpenAndSearch);
  const t0 = Date.now();
  await page.reload({ waitUntil: 'commit' });
  await expect(bookCards(page).first(), 'the seeded books must appear on the Library screen').toBeVisible({ timeout: 15_000 });
  const elapsed = Date.now() - t0;
  const tasks = await longTasks(page);
  console.log(`library open (${BUDGETS.library.sizeForOpenAndSearch} books, ${BUDGETS.tap.cpuThrottle}x CPU slowdown): ${elapsed} ms, long tasks ${JSON.stringify(tasks.map(Math.round))}`);
  expect(elapsed, `open time ${elapsed} ms`).toBeLessThanOrEqual(BUDGETS.library.openMs);
  expect(Math.max(0, ...tasks), `long tasks (ms): ${JSON.stringify(tasks.map(Math.round))}`).toBeLessThanOrEqual(BUDGETS.jank.maxLongTaskMs);
});

test(`scrolling a ${BUDGETS.library.sizeForScroll}-book library stays smooth (blueprint 16: 60 fps)`, async ({ page }, testInfo) => {
  await openSeededLibrary(page, BUDGETS.library.sizeForScroll);
  await expect(bookCards(page).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => { (window as unknown as { __longTasks: number[] }).__longTasks = []; });
  const j = BUDGETS.jank;
  const stats = await flingScroll(page, 'document', j.scrollSeconds, j.scrollPxPerSecond, 33.4);
  const tasks = await longTasks(page);
  const line = `scroll: ${stats.frames} frames, p95 ${stats.p95Ms.toFixed(1)} ms, worst ${stats.maxMs.toFixed(1)} ms, dropped ${(stats.droppedRatio * 100).toFixed(1)} %, scrolled ${Math.round(stats.scrolledPx)} px, long tasks ${JSON.stringify(tasks.map(Math.round))}`;
  console.log(line);
  await testInfo.attach('library-scroll.txt', { body: line, contentType: 'text/plain' });
  expect(stats.scrolledPx, `the library did not scroll (the page). ${line}`).toBeGreaterThan(1000);
  expect(stats.p95Ms, line).toBeLessThanOrEqual(j.p95FrameMs);
  expect(stats.droppedRatio, line).toBeLessThanOrEqual(j.maxDroppedFrameRatio);
  expect(stats.maxMs, line).toBeLessThanOrEqual(j.maxFrameMs);
  expect(Math.max(0, ...tasks), line).toBeLessThanOrEqual(j.maxLongTaskMs);
});

test(`search narrows a ${BUDGETS.library.sizeForOpenAndSearch}-book library within ${BUDGETS.library.searchMs} ms (blueprint 5.5)`, async ({ page }) => {
  await openSeededLibrary(page, BUDGETS.library.sizeForOpenAndSearch);
  const field = searchField(page);
  await expect(field, 'Library has no search field (blueprint 5.5: top of the Library screen)').toBeVisible();
  await expect(bookCards(page).first()).toBeVisible({ timeout: 15_000 });
  await field.click();
  const ms = await measureInput(page, allCardsMatch('Zebra'), () => field.pressSequentially('zebra', { delay: 30 }), 3000);
  console.log(`search: ${ms.toFixed(0)} ms`);
  expect(ms, `search took ${ms.toFixed(0)} ms after the last keystroke`).toBeLessThanOrEqual(BUDGETS.library.searchMs);
});

test(`the Favorites filter responds within ${BUDGETS.library.filterMs} ms on a ${BUDGETS.library.sizeForOpenAndSearch}-book library (blueprint 5.5)`, async ({ page }) => {
  await openSeededLibrary(page, BUDGETS.library.sizeForOpenAndSearch);
  await expect(bookCards(page).first()).toBeVisible({ timeout: 15_000 });
  const chip = filterChip(page, 'Favorites');
  await expect(chip, 'Library has no "Favorites" filter chip (blueprint 5.5)').toBeVisible();
  const ms = await measureInput(page, allCardsMatch('Starred Book'), () => chip.tap(), 3000);
  console.log(`favorites filter: ${ms.toFixed(0)} ms (every ${SEED.favoriteEvery}th book is a favorite)`);
  expect(ms, `filter took ${ms.toFixed(0)} ms`).toBeLessThanOrEqual(BUDGETS.library.filterMs);
});
