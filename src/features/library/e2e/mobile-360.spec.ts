import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { cards, seedBooks } from './support';

// The Library at 360 px wide, the narrowest phone we design for. Screenshots go to the folder the Design
// Reviewer reads (override with PAGENEST_SHOTS).
const SHOTS = process.env.PAGENEST_SHOTS ?? '/workspace/pn-shots2/library-2';
mkdirSync(SHOTS, { recursive: true });
test.use({ viewport: { width: 360, height: 740 } });

async function open(page: Page, count: number): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible();
  if (count > 0) {
    await seedBooks(page, count);
    await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(page.getByRole('heading', { name: 'Your library is empty' })).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

test('the empty library at 360 px: the designed empty state with the sample card and one Add books button', async ({ page }) => {
  await open(page, 0);
  await expect(page.getByRole('button', { name: 'Add books' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Add the sample book/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.screenshot({ path: join(SHOTS, '01-empty-library-360.png') });
});

test('the filter row is one row at 360 px, with Favorites on screen, a fade at its end, and no sideways page', async ({ page }) => {
  await open(page, 30);
  const geometry = await page.evaluate(() => {
    const group = document.querySelector('.pn-library__filters .pn-chip-group') as HTMLElement;
    const chips = [...group.querySelectorAll('button')].map((b) => {
      const r = b.getBoundingClientRect();
      return { name: b.textContent ?? '', top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
    });
    const wrap = document.querySelector('.pn-library__filters') as HTMLElement;
    const fade = getComputedStyle(wrap, '::after');
    return { chips, groupHeight: group.getBoundingClientRect().height, fadeContent: fade.content, fadeWidth: fade.width, page: document.documentElement.scrollWidth };
  });
  expect(geometry.chips.map((c) => c.name)).toEqual(['All', 'Favorites', 'Reading', 'Listening', 'Finished']);
  expect(new Set(geometry.chips.map((c) => c.top)).size, 'every chip sits on the same line').toBe(1);
  expect(geometry.groupHeight).toBeLessThan(56);
  const favorites = geometry.chips.find((c) => c.name === 'Favorites');
  expect(favorites && favorites.right <= 360, 'Favorites is visible without scrolling').toBe(true);
  expect(geometry.fadeContent, 'the fade at the end of the row').not.toBe('none');
  expect(geometry.page, 'the page does not scroll sideways').toBeLessThanOrEqual(360);
  // The row scrolls sideways inside itself to reach the rest.
  const scrolls = await page.evaluate(() => {
    const group = document.querySelector('.pn-library__filters .pn-chip-group') as HTMLElement;
    return group.scrollWidth >= group.clientWidth;
  });
  expect(scrolls).toBe(true);
});

test('a grid of covers at 360 px, then the list', async ({ page }) => {
  await open(page, 400);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.screenshot({ path: join(SHOTS, '02-populated-grid-360.png') });
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Grid of covers' })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, '03-list-view-360.png') });
});

test('every drawn row has the same height, so the scroll bar and the windowing stay true (grid and list)', async ({ page }) => {
  await open(page, 400);
  for (const view of ['grid', 'list'] as const) {
    if (view === 'list') {
      await page.getByRole('button', { name: 'List', exact: true }).click();
      await page.waitForTimeout(300);
    }
    for (const at of [0, 2500, 6000]) {
      await page.evaluate((y) => window.scrollTo(0, y), at);
      await page.waitForTimeout(250);
      const heights = await page.evaluate(() => [...document.querySelectorAll('.pn-library__grid > li')].map((li) => Math.round(li.getBoundingClientRect().height * 10) / 10));
      expect(heights.length, `${view} at ${at}`).toBeGreaterThan(3);
      expect(new Set(heights).size, `${view} at ${at}: ${heights.join(', ')}`).toBe(1);
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
});

test('tapping a book opens the design system detail sheet at 360 px, with the menu holding Remove', async ({ page }) => {
  await open(page, 30);
  await page.getByRole('button', { name: /Book 00000/ }).first().tap();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Start reading|Continue reading|Read again|Listen/ }).first()).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'More options' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Remove from library' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SHOTS, '04-detail-sheet-360.png') });
  await sheet.getByRole('button', { name: 'More options' }).tap();
  await expect(page.getByRole('menuitem', { name: 'Remove from library' })).toBeVisible();
});
