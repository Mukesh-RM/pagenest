import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './support/app';
import { expectNoA11yViolations } from './support/axe';
import { expectNoOverflow } from './support/layout';
import { bookCards, sampleEdgeCases, seedLibrary } from './support/library';

// Design review: the Library must look right with awkward real-world data. `sampleEdgeCases` (support/library.ts) is
// always part of a seeded library. Screenshots go to tests/artifacts (not docs/screens, which holds approved shots).
const ARTIFACTS = resolve(dirname(fileURLToPath(import.meta.url)), '../artifacts');

test.describe('Library with edge-case books', () => {
  test.beforeEach(async ({ page }) => {
    await launch(page);
    await seedLibrary(page, { count: 5 });
    await expect(bookCards(page).first()).toBeVisible();
  });

  test('every edge case renders as a card, and each card stays inside its column', async ({ page }) => {
    const cards = bookCards(page);
    await expect(cards).toHaveCount(5 + sampleEdgeCases.length);
    const widths = await cards.evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { right: r.right, width: r.width, text: (el.textContent ?? '').slice(0, 30) }; }));
    const vw = page.viewportSize()!.width;
    for (const w of widths) expect(w.right, `card "${w.text}" extends past the screen`).toBeLessThanOrEqual(vw + 1);
    // all cards in the grid have the same width: a long word or title must not stretch one
    const unique = new Set(widths.map((w) => Math.round(w.width)));
    expect(unique.size, `card widths differ: ${[...unique].join(', ')}`).toBeLessThanOrEqual(1);
    await expectNoOverflow(page, 'Library with edge-case books');
  });

  test('long titles and two-line authors are clamped, not clipped mid-card', async ({ page }) => {
    const long = bookCards(page).filter({ hasText: 'Extraordinarily Long' });
    await expect(long).toHaveCount(1);
    const box = await long.boundingBox();
    const parts = await long.evaluate((el) => {
      const [title, author] = [...el.querySelectorAll('p')];
      const rect = (e: Element | undefined) => { const r = e?.getBoundingClientRect(); return r ? { top: r.top, bottom: r.bottom } : null; };
      return { card: rect(el), title: rect(title), author: rect(author) };
    });
    expect(parts.title!.bottom, 'title stays inside the card').toBeLessThanOrEqual(box!.y + box!.height + 1);
    const author = bookCards(page).filter({ hasText: 'Two Authors, Two Lines' });
    await expect(author).toHaveCount(1);
    const aBox = await author.boundingBox();
    const authorBottom = await author.evaluate((el) => [...el.querySelectorAll('p')].at(-2)?.getBoundingClientRect().bottom ?? 0);
    expect(authorBottom, 'author line stays inside the card').toBeLessThanOrEqual(aBox!.y + aBox!.height + 1);
  });

  test('0 % and 100 % progress bars are shown with the right values', async ({ page }) => {
    await expect(page.getByRole('progressbar', { name: 'Progress for Not Started Yet' })).toHaveAttribute('aria-valuenow', '0');
    await expect(page.getByRole('progressbar', { name: 'Progress for Finished and Closed' })).toHaveAttribute('aria-valuenow', '100');
    await expect(page.getByRole('progressbar', { name: 'Progress for Long Drive Home' })).toHaveAttribute('aria-valuenow', '50');
  });

  test('a book without a cover still shows its title and format', async ({ page }) => {
    const card = bookCards(page).filter({ hasText: 'A Book Without a Cover' });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(/epub/i);
  });

  test('the Library with edge cases is axe-clean', async ({ page }) => {
    await expectNoA11yViolations(page, 'Library with edge-case books');
  });

  test('screenshot the Library with the edge cases (tests/artifacts)', async ({ page }, testInfo) => {
    await mkdir(ARTIFACTS, { recursive: true });
    const file = resolve(ARTIFACTS, `library-edge-cases-${testInfo.project.name}.png`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, fullPage: true });
    await testInfo.attach('library-edge-cases', { path: file, contentType: 'image/png' });
    console.log(`screenshot: ${file}`);
  });
});
