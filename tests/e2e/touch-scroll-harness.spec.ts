import { expect, test } from '@playwright/test';
import { touchScroll } from './support/perf';

// Harness self-check for touchScroll: it must move a normal tall page with a real touch gesture, and it must FAIL LOUDLY on
// a page where touch scrolling goes nowhere (instead of measuring "smooth" jank on a page that never moved).
// Chromium touch (CDP) only: the Pixel 7 project. No app needed.
const TALL = (extra: string) => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}.row{height:60px;border-bottom:1px solid #ccc}${extra}</style>
${Array.from({ length: 400 }, (_, i) => `<div class="row">row ${i}</div>`).join('')}`;

test.describe('touch scroll harness', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || !isMobile, 'touch gestures need the Chromium phone project');

  test('a touch gesture scrolls a tall page and the helper reports the distance', async ({ page }) => {
    await page.setContent(TALL(''));
    const stats = await touchScroll(page, 1, 2000, 33.4);
    expect(stats.scrolledPx).toBeGreaterThan(1000);
    expect(stats.frames).toBeGreaterThan(10);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  });

  test('a page that cannot be touch-scrolled makes the helper throw, not pass', async ({ page }) => {
    await page.setContent(TALL('html,body{touch-action:none;overscroll-behavior:none}'));
    await expect(touchScroll(page, 1, 2000, 33.4)).rejects.toThrow(/did not scroll the page/);
  });

  test('a page with nothing to scroll makes the helper throw', async ({ page }) => {
    await page.setContent('<!doctype html><meta name="viewport" content="width=device-width"><p>short</p>');
    await expect(touchScroll(page, 1, 2000, 33.4)).rejects.toThrow(/nothing to measure/);
  });
});
