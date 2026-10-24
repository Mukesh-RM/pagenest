import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './support/axe';
import { launchFresh, onboardingSkip, primaryNav, screenHeading } from './support/app';

// First launch shows three onboarding cards (src/app/onboarding). Every other test skips them through `launch()`;
// these are the only tests that look at onboarding itself.

const welcome = (page: Page) =>
  page.getByRole('heading', { level: 1, name: /your books, your voice, no account/i });

test.describe('first-run onboarding', () => {
  test('a fresh launch shows onboarding, not the tabs', async ({ page }) => {
    await launchFresh(page);
    await expect(welcome(page)).toBeVisible();
    await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
    await expect(onboardingSkip(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /^next$/i })).toBeVisible();
    await expect(primaryNav(page)).toHaveCount(0);
  });

  test('onboarding screens are axe-clean', async ({ page }) => {
    await launchFresh(page);
    await expect(welcome(page)).toBeVisible();
    await expectNoA11yViolations(page, 'onboarding card 1');
    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible();
    await expectNoA11yViolations(page, 'onboarding card 2');
    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: /pick a look/i })).toBeVisible();
    await expectNoA11yViolations(page, 'onboarding card 3');
  });

  test('Skip goes to the Library and onboarding never comes back after a reload', async ({ page }) => {
    await launchFresh(page);
    await onboardingSkip(page).click();
    await expect(primaryNav(page)).toBeVisible();
    await expect(screenHeading(page, 'Library')).toBeVisible();
    await page.reload();
    await expect(primaryNav(page)).toBeVisible();
    await expect(welcome(page)).toHaveCount(0);
  });

  test('Next, Next, Done also ends onboarding; Skip is not offered on the last card', async ({ page }) => {
    await launchFresh(page);
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page.getByText(/step 3 of 3/i)).toBeVisible();
    await expect(onboardingSkip(page)).toHaveCount(0);
    await page.getByRole('button', { name: /^done$/i }).click();
    await expect(screenHeading(page, 'Library')).toBeVisible();
  });

  test('Back returns to the previous card', async ({ page }) => {
    await launchFresh(page);
    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible();
    await page.getByRole('button', { name: /^back$/i }).click();
    await expect(welcome(page)).toBeVisible();
  });
});
