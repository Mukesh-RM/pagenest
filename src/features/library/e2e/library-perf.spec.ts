import { expect, test, type Page } from '@playwright/test';
import { cards, consoleErrors, flingScroll, longTasks, measureInput, recordLongTasks, resetLongTasks, seedBooks, throttleCpu, waitForQuiet } from './support';

// Mirrors QA's gates (tests/perf/budgets.ts) against the Library screen with the real data worker and IndexedDB.
// Books are seeded straight into the `books` store of the `pagenest` database, with no import step.
const G = { cpu: 4, openMs: 2000, inputMs: 100, p95Ms: 33.4, dropped: 0.05, maxTaskMs: 100, maxFrameMs: 100, seconds: 2.5, pxPerSecond: 3000 } as const;

async function openSeeded(page: Page, count: number): Promise<void> {
  await recordLongTasks(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your library is empty' }).or(page.getByRole('main'))).toBeVisible();
  await seedBooks(page, count);
  await throttleCpu(page, G.cpu);
}

const firstCardsMatch = (pattern: string): string =>
  `(() => { const c = [...document.querySelectorAll('main [role="listitem"]')].slice(0, 30); return c.length > 0 && c.every((e) => /${pattern}/.test(e.textContent ?? '')); })()`;

test('a library of 1,000 books opens within 1 s (first book on screen) with no task over 100 ms', async ({ page }) => {
  await openSeeded(page, 1000);
  // In-page clock: from the start of the navigation to the first book in the page, so the number does not
  // include Playwright's own polling (which adds up to 100 ms or more under a 4x CPU slowdown).
  await page.addInitScript(() => {
    const w = window as unknown as { __firstBook?: number };
    const look = (): boolean => {
      if (w.__firstBook === undefined && document.querySelector('main [role="listitem"]')) {
        w.__firstBook = performance.now();
        return true;
      }
      return w.__firstBook !== undefined;
    };
    new MutationObserver((_, observer) => {
      if (look()) observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
  const t0 = Date.now();
  await page.reload({ waitUntil: 'commit' });
  await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
  const wall = Date.now() - t0;
  const inPage = await page.evaluate(() => (window as unknown as { __firstBook?: number }).__firstBook ?? -1);
  const tasks = await longTasks(page);
  console.log(`PERF open 1000 books (${G.cpu}x CPU slowdown): first book at ${Math.round(inPage)} ms in page (${wall} ms by the test clock), long tasks ${JSON.stringify(tasks.map(Math.round))}`);
  expect(inPage).toBeGreaterThan(0);
  expect(inPage).toBeLessThan(1000);
  expect(wall).toBeLessThanOrEqual(G.openMs);
  expect(Math.max(0, ...tasks)).toBeLessThanOrEqual(G.maxTaskMs);
  expect(await consoleErrors(page)).toEqual([]);
});

for (const view of ['grid', 'list'] as const) {
  test(`scrolling 5,000 books as a ${view} stays smooth`, async ({ page }) => {
    await openSeeded(page, 5000);
    await expect(cards(page).first()).toBeVisible({ timeout: 20_000 });
    if (view === 'list') {
      await page.getByRole('button', { name: 'List', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Grid of covers' })).toBeVisible();
    }
    await page.waitForTimeout(500);
    await resetLongTasks(page);
    const stats = await flingScroll(page, G.seconds, G.pxPerSecond, G.p95Ms);
    const tasks = await longTasks(page);
    const mounted = await cards(page).count();
    console.log(
      `PERF scroll 5000 ${view} (${G.cpu}x CPU slowdown): ${stats.frames} frames, p95 ${stats.p95Ms.toFixed(1)} ms, worst ${stats.maxMs.toFixed(1)} ms, dropped ${(stats.droppedRatio * 100).toFixed(1)} %, scrolled ${Math.round(stats.scrolledPx)} px, long tasks ${JSON.stringify(tasks.map(Math.round))}, cards mounted ${mounted}`,
    );
    expect(stats.scrolledPx).toBeGreaterThan(1000);
    expect(stats.p95Ms).toBeLessThanOrEqual(G.p95Ms);
    expect(stats.droppedRatio).toBeLessThanOrEqual(G.dropped);
    expect(stats.maxMs).toBeLessThanOrEqual(G.maxFrameMs);
    expect(Math.max(0, ...tasks)).toBeLessThanOrEqual(G.maxTaskMs);
    expect(mounted).toBeLessThan(150); // windowed: never one element per book
    expect(await consoleErrors(page)).toEqual([]);
  });
}

test('search narrows 1,000 books within 100 ms', async ({ page }) => {
  await openSeeded(page, 1000);
  await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
  await waitForQuiet(page);
  const field = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i)).first();
  await field.click();
  const ms = await measureInput(page, firstCardsMatch('Zebra'), () => field.pressSequentially('zebra', { delay: 30 }), 3000);
  console.log(`PERF search 1000 books: ${ms.toFixed(0)} ms after the last keystroke`);
  expect(ms).toBeLessThanOrEqual(G.inputMs);
});

test('the Favorites chip responds within 100 ms on 1,000 books', async ({ page }) => {
  await openSeeded(page, 1000);
  await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
  const chip = page.getByRole('button', { name: /^Favorites$/ }).or(page.getByRole('radio', { name: /^Favorites$/ })).first();
  await expect(chip).toBeVisible();
  const rested = await waitForQuiet(page); // the list has finished loading and drawing: this gate measures the tap, not the open
  console.log(`PERF page at rest after ${Math.round(rested)} ms`);
  const ms = await measureInput(page, firstCardsMatch('Starred Book'), () => chip.tap(), 3000);
  console.log(`PERF favorites filter 1000 books: ${ms.toFixed(0)} ms`);
  expect(ms).toBeLessThanOrEqual(G.inputMs);
});
