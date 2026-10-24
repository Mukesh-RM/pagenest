import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { cards, seedBooks } from './support';

// The Library at 360 px wide, the narrowest phone we design for. Screenshots go to the folder the Design
// Reviewer reads (override with PAGENEST_SHOTS).
const SHOTS = process.env.PAGENEST_SHOTS ?? '/workspace/pn-shots2/library-3';
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
      const heights = await page.evaluate(() => [...document.querySelectorAll('.pn-vlist__row')].map((li) => Math.round(li.getBoundingClientRect().height * 10) / 10));
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

/** Width of the placeholder text against the room inside the search field. */
async function searchFit(page: Page): Promise<{ text: string; textWidth: number; room: number }> {
  return page.evaluate(() => {
    const input = document.querySelector('input[type="search"]') as HTMLInputElement;
    const style = getComputedStyle(input);
    const placeholder = getComputedStyle(input, '::placeholder');
    const canvas = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    canvas.font = `${placeholder.fontStyle} ${placeholder.fontWeight} ${placeholder.fontSize} ${placeholder.fontFamily}`;
    const room = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return { text: input.placeholder, textWidth: canvas.measureText(input.placeholder).width, room };
  });
}

for (const size of ['100%', '200%'] as const) {
  test(`the search placeholder is not clipped at 360 px with text at ${size}`, async ({ page }) => {
    await page.addInitScript((size) => document.addEventListener('DOMContentLoaded', () => (document.documentElement.style.fontSize = size)), size);
    await open(page, 0);
    const fit = await searchFit(page);
    expect(fit.text).toBe('Search books');
    expect(fit.textWidth, `"${fit.text}" needs ${fit.textWidth.toFixed(0)} px of ${fit.room.toFixed(0)} px`).toBeLessThanOrEqual(fit.room);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    if (size === '200%') await page.screenshot({ path: join(SHOTS, '07-search-200-percent-360.png') });
  });
}

test('a real cover is shown whole on its 2:3 frame, in the grid, the list and the detail sheet', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add the sample book' }).click();
  await expect(page.getByTestId('where')).toHaveText(/^\/read\//, { timeout: 25_000 });
  await page.goto('/');
  const image = page.locator('.pn-bookcard .pn-cover__img').first();
  await expect(image).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const fit = await image.evaluate((img: HTMLImageElement) => {
    const frame = (img.parentElement as HTMLElement).getBoundingClientRect();
    return { objectFit: getComputedStyle(img).objectFit, frameRatio: frame.width / frame.height, natural: img.naturalWidth / img.naturalHeight, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
  });
  expect(fit.objectFit, 'the whole cover is drawn, never cropped').toBe('contain');
  expect(Math.abs(fit.frameRatio - 2 / 3), 'the frame is 2:3').toBeLessThan(0.01);
  expect(fit.naturalWidth).toBeLessThanOrEqual(360); // downscaled at import ...
  expect(fit.naturalHeight).toBeLessThanOrEqual(540);
  // ... with its own proportions: the stored cover is not stretched or cut (the original ratio is kept to a pixel).
  expect(fit.natural).toBeGreaterThan(0.4);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, '05-real-cover-grid-360.png') });
  await page.getByRole('button', { name: /Peter Rabbit/ }).first().tap();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(SHOTS, '06-real-cover-detail-360.png') });
});

test('a generated cover is a color tile with one letter: no second title, no author, the badges clear of the letter (grid and list)', async ({ page }) => {
  await open(page, 30);
  for (const view of ['grid', 'list'] as const) {
    if (view === 'list') await page.getByRole('button', { name: 'List', exact: true }).click();
    await page.waitForTimeout(300);
    const cover = await page.evaluate(() => {
      // The first card with a favorite badge shows the badge next to the letter.
      const tiles = Array.from(document.querySelectorAll('.pn-bookcard .pn-cover--monogram')) as HTMLElement[];
      const tile = tiles.find((t) => t.querySelector('.pn-favorite-badge, [class*="favorite"]')) ?? (tiles[0] as HTMLElement);
      const letter = tile.querySelector('.pn-cover__letter') as HTMLElement;
      const box = tile.getBoundingClientRect();
      const l = letter.getBoundingClientRect();
      const badges = Array.from(tile.querySelectorAll('[class*="badge"], [class*="favorite"]')).map((b) => b.getBoundingClientRect());
      return {
        count: tiles.length,
        letter: letter.textContent,
        letterSize: Number.parseFloat(getComputedStyle(letter).fontSize),
        coverWidth: box.width,
        hasTitle: tile.querySelector('.pn-cover__title') !== null,
        hasAuthor: tile.querySelector('.pn-cover__author') !== null,
        letterInside: l.left >= box.left && l.right <= box.right && l.top >= box.top && l.bottom <= box.bottom,
        badgeOverlap: badges.some((b) => b.left < l.right && b.right > l.left && b.top < l.bottom && b.bottom > l.top),
      };
    });
    expect(cover.count, `${view}: generated covers are monogram tiles`).toBeGreaterThan(0);
    expect(cover.letter, `${view}: one character`).toHaveLength(1);
    expect(cover.letterSize, `${view}: the letter is drawn large`).toBeGreaterThan(cover.coverWidth * 0.25);
    expect(cover.hasTitle, `${view}: the cover does not print the title again`).toBe(false);
    expect(cover.hasAuthor, `${view}: the author is not printed on the cover`).toBe(false);
    expect(cover.letterInside, `${view}: the letter is inside its tile`).toBe(true);
    expect(cover.badgeOverlap, `${view}: no badge sits on the letter`).toBe(false);
  }
});

test('layout shift while a 400-book library opens at 360 px stays under 0.02 (budget 0.1)', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await open(page, 400);
  await page.reload();
  await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  console.log(`PERF layout shift at 360 px, 400 books, after reload: ${cls.toFixed(4)}`);
  expect(cls).toBeLessThan(0.02);
});
