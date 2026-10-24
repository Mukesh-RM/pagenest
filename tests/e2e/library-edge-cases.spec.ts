import { expect, test, type Locator } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './support/app';
import { expectNoA11yViolations } from './support/axe';
import { expectNoOverflow } from './support/layout';
import { bookCards, findCard, sampleEdgeCases, scanCards, seedLibrary } from './support/library';

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
    // the Library may window its list, so walk it top to bottom and judge every card seen
    const cards = await scanCards(page);
    expect(cards.length, `cards seen: ${cards.map((c) => c.text.slice(0, 20)).join(' | ')}`).toBe(5 + sampleEdgeCases.length);
    const vw = page.viewportSize()!.width;
    for (const c of cards) expect(c.right, `card "${c.text.slice(0, 30)}" extends past the screen`).toBeLessThanOrEqual(vw + 1);
    // all cards in the grid have the same width: a long word or title must not stretch one
    const unique = new Set(cards.map((c) => Math.round(c.width)));
    expect(unique.size, `card widths differ: ${[...unique].join(', ')}`).toBeLessThanOrEqual(1);
    await expectNoOverflow(page, 'Library with edge-case books');
  });

  /** Every descendant of the card with text or a box stays inside the card (structure-agnostic: no assumptions about which element is the title). */
  async function expectContentInsideCard(card: Locator, what: string): Promise<void> {
    const out = await card.evaluate((el) => {
      const c = el.getBoundingClientRect();
      return [...el.querySelectorAll('*')].map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.width > 0 && r.height > 0)
        .filter(({ r }) => r.right > c.right + 1 || r.left < c.left - 1 || r.bottom > c.bottom + 1 || r.top < c.top - 1)
        .map(({ e }) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)} "${(e.textContent ?? '').slice(0, 20)}"`);
    });
    expect(out, `${what}: content pokes out of its card`).toEqual([]);
  }

  test('long titles and two-line authors are clamped, not clipped mid-card', async ({ page }) => {
    await expectContentInsideCard(await findCard(page, 'Extraordinarily Long'), 'very long title');
    await expectContentInsideCard(await findCard(page, 'Two Authors, Two Lines'), 'two-line author');
  });

  test('0 % and 100 % progress are shown with the right values', async ({ page }) => {
    // Card markup differs between Library versions, so read progress whichever way the card shows it: a progressbar's
    // aria-valuenow, a fill drawn with a percentage width or --pn-progress, or a finished/not-started label. 0 % may show no bar.
    const progressOf = (card: Locator) => card.evaluate((el) => {
      const bar = el.querySelector('[role="progressbar"]');
      if (bar?.getAttribute('aria-valuenow')) return Number(bar.getAttribute('aria-valuenow'));
      for (const f of el.querySelectorAll<HTMLElement>('[class*="progress"] *, [class*="progress"]')) {
        const w = /([\d.]+)%/.exec(f.style.width)?.[1];
        if (w !== undefined) return Number(w);
        const v = f.style.getPropertyValue('--pn-progress');
        if (v !== '') return Number(v) <= 1 ? Number(v) * 100 : Number(v);
      }
      const label = `${el.getAttribute('aria-label') ?? ''} ${el.textContent ?? ''}`;
      if (/finished/i.test(label)) return 100;
      return null;
    });
    for (const [title, want] of [['Not Started Yet', 0], ['Finished and Closed', 100], ['Long Drive Home', 50]] as const) {
      const value = await progressOf(await findCard(page, title));
      if (want === 0) expect(value === null || value === 0, `${title} shows ${value} % instead of nothing or 0 %`).toBe(true);
      else expect(value, `${title} shows ${value} %`).toBe(want);
    }
  });

  test('a book without a cover still renders as a card with its title', async ({ page }) => {
    const card = await findCard(page, 'A Book Without a Cover');
    await expect(card).toContainText('A Book Without a Cover');
    expect((await card.boundingBox())!.height, 'the card has a body').toBeGreaterThan(60);
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
