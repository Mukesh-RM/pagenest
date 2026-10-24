import { test } from '@playwright/test';
import { gotoTab, launch, TABS } from '../e2e/support/app';
import { expectLabelInName } from '../e2e/support/axe';
import { seedLibrary } from '../e2e/support/library';
import { expectResumeCardRendered, seedResumeBook } from '../e2e/support/resume';

// Lighthouse best practices flagged label-content-name-mismatch on the Library: a control whose aria-label does not
// contain its visible text (WCAG 2.5.3). This gate runs the axe rule on the screens with real content.
test.describe('label in name (WCAG 2.5.3)', () => {
  test('Library with books and the resume card', async ({ page }) => {
    await launch(page);
    await seedLibrary(page, { count: 30 });
    await seedResumeBook(page);
    await expectResumeCardRendered(page);
    await expectLabelInName(page, 'Library');
  });

  for (const name of TABS.filter((t) => t !== 'Library')) {
    test(`${name} screen`, async ({ page }) => {
      await launch(page);
      await seedLibrary(page, { count: 30 });
      await gotoTab(page, name);
      await expectLabelInName(page, name);
    });
  }
});
