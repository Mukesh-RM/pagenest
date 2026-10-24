import { expect, test } from '@playwright/test';
import { launch } from '../e2e/support/app';
import { findCard, seedLibrary } from '../e2e/support/library';

// Design-review gate on the Library card with awkward data (see sampleEdgeCases in e2e/support/library.ts).
// Lives with the quality gates, not the stable e2e suite, because it currently fails on a real defect (owner: Library / UI/UX).

test.describe('Library edge cases (quality gate)', () => {
  test.beforeEach(async ({ page }) => {
    await launch(page);
    await seedLibrary(page, { count: 5 });
    await expect(page.getByRole('main').getByRole('listitem').first()).toBeVisible();
  });

  test('a long word without spaces in a title wraps or ends with an ellipsis instead of being cut off', async ({ page }) => {
    const card = await findCard(page, 'Pneumonoultramicroscopic');
    // every visible element in the card that carries the word (the title, and a generated cover may repeat it)
    const ms = await card.evaluate((el) => [...el.querySelectorAll('*')]
      .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && /Pneumonoultra/.test(n.textContent ?? '')))
      .map((e) => {
        const cs = getComputedStyle(e);
        return { where: `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}`, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth, ellipsis: cs.textOverflow === 'ellipsis', wraps: cs.overflowWrap === 'anywhere' || cs.overflowWrap === 'break-word' || cs.wordBreak === 'break-all' || cs.wordBreak === 'break-word' };
      }));
    expect(ms.length, 'the word is on the card').toBeGreaterThan(0);
    for (const m of ms) {
      expect(m.scrollWidth > m.clientWidth + 1 && !m.ellipsis && !m.wraps,
        `${m.where}: the title is cut off mid-word (scrollWidth ${m.scrollWidth} > clientWidth ${m.clientWidth}); add overflow-wrap:anywhere or an ellipsis`).toBe(false);
    }
  });
});
