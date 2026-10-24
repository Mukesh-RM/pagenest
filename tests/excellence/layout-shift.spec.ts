import { expect, test, type Page } from '@playwright/test';
import { launch, launchFresh, onboardingSkip, primaryNav, screenHeading, TABS, gotoTab } from '../e2e/support/app';
import { describeShifts, readCls, recordLayoutShift } from '../e2e/support/layout';
import { seedLibrary } from '../e2e/support/library';
import { expectResumeCardRendered, seedResumeBook } from '../e2e/support/resume';
import { throttleCpu } from '../e2e/support/perf';
import { BUDGETS } from './../perf/budgets';

// CLS gates the Design Reviewer asked for. Strict: under 0.1 (budgets.lighthouse.maxCls) on a phone profile with the CPU
// slowed 4x (late data and fonts shift more on slow phones). A failure names the elements that moved (PerformanceObserver
// layout-shift sources), which is the owner's to-do list: shifts inside the Library list or resume card belong to Library
// (src/features/library, src/app/components/ResumeCard.tsx with UI/UX); shifts of the shell, tab bar or onboarding to UI/UX.
const MAX = BUDGETS.lighthouse.maxCls;

async function settle(page: Page, ms = 1500): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

test.describe('layout shift (CLS) gates', () => {
  test('first launch: onboarding visible, load plus the first interactions, CLS under the limit', async ({ page }) => {
    await recordLayoutShift(page);
    await throttleCpu(page, BUDGETS.tap.cpuThrottle);
    await launchFresh(page);
    await expect(onboardingSkip(page), 'onboarding must be on screen on a fresh profile (otherwise this is not a first launch)').toBeVisible();
    await settle(page);
    // first interactions: through all three onboarding cards, into the Library, then every tab
    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible();
    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page.getByText(/step 3 of 3/i)).toBeVisible();
    await page.getByRole('button', { name: /^done$/i }).click();
    await expect(primaryNav(page)).toBeVisible();
    await expect(screenHeading(page, 'Library')).toBeVisible();
    for (const t of TABS) await gotoTab(page, t);
    await gotoTab(page, 'Library');
    await settle(page);
    const { cls, shifts } = await readCls(page);
    expect(cls, `first-launch CLS ${cls.toFixed(3)} (limit ${MAX}); shifting elements:\n${describeShifts(shifts)}`).toBeLessThan(MAX);
  });

  test('Library with the "Welcome back" resume card: CLS under the limit', async ({ page }) => {
    await launch(page); // creates the database and skips onboarding
    await seedResumeBook(page);
    await recordLayoutShift(page); // applies to the next document: the cold load that shows the card
    await throttleCpu(page, BUDGETS.tap.cpuThrottle);
    await page.reload();
    await expectResumeCardRendered(page); // loud failure if the card is missing: a CLS without it proves nothing
    await settle(page);
    const { cls, shifts } = await readCls(page);
    expect(cls, `Library CLS with the resume card ${cls.toFixed(3)} (limit ${MAX}); shifting elements:\n${describeShifts(shifts)}`).toBeLessThan(MAX);
  });

  test(`Library with the resume card and ${BUDGETS.lighthouse.scenarios.libraryBooks} books: CLS under the limit`, async ({ page }) => {
    await launch(page);
    await seedLibrary(page, { count: BUDGETS.lighthouse.scenarios.libraryBooks });
    await seedResumeBook(page);
    await recordLayoutShift(page);
    await throttleCpu(page, BUDGETS.tap.cpuThrottle);
    await page.reload();
    await expectResumeCardRendered(page);
    await expect(page.getByRole('main').getByRole('listitem').first()).toBeVisible();
    await settle(page);
    await page.evaluate(() => window.scrollBy(0, innerHeight)); // a first scroll through the list
    await settle(page, 800);
    const { cls, shifts } = await readCls(page);
    expect(cls, `Library CLS with the resume card and ${BUDGETS.lighthouse.scenarios.libraryBooks} books ${cls.toFixed(3)} (limit ${MAX}); shifting elements:\n${describeShifts(shifts)}`).toBeLessThan(MAX);
  });
});
