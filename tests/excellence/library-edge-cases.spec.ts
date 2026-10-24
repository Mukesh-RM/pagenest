import { expect, test } from '@playwright/test';
import { launch } from '../e2e/support/app';
import { bookCards, seedLibrary } from '../e2e/support/library';

// Design-review gate on the Library card with awkward data (see sampleEdgeCases in e2e/support/library.ts).
// Lives with the quality gates, not the stable e2e suite, because it currently fails on a real defect (owner: Library / UI/UX).

test.describe('Library edge cases (quality gate)', () => {
  test.beforeEach(async ({ page }) => {
    await launch(page);
    await seedLibrary(page, { count: 5 });
    await expect(bookCards(page).first()).toBeVisible();
  });

  test('a long word without spaces in a title wraps or ends with an ellipsis instead of being cut off', async ({ page }) => {
    const card = bookCards(page).filter({ hasText: 'Pneumonoultramicroscopic' });
    await expect(card).toHaveCount(1);
    const m = await card.evaluate((el) => {
      const title = el.querySelector('p')!;
      const cs = getComputedStyle(title);
      return { scrollWidth: title.scrollWidth, clientWidth: title.clientWidth, ellipsis: cs.textOverflow === 'ellipsis', wraps: cs.overflowWrap === 'anywhere' || cs.overflowWrap === 'break-word' || cs.wordBreak === 'break-all' || cs.wordBreak === 'break-word' };
    });
    expect(m.scrollWidth > m.clientWidth + 1 && !m.ellipsis && !m.wraps,
      `the title is cut off mid-word (scrollWidth ${m.scrollWidth} > clientWidth ${m.clientWidth}); add overflow-wrap:anywhere or an ellipsis`).toBe(false);
  });
});
