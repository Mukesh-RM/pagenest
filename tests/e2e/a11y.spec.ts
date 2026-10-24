import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoContrastViolations } from './support/axe';
import {
  TABS, chooseTheme, gotoTab, installHelpButton, launch, openSheet, primaryNav, sheet,
} from './support/app';
import { THEMES, THEME_NAMES, contrastRatio, toHex } from './support/contrast';

test.describe('accessibility (axe)', () => {
  for (const name of TABS) {
    test(`${name} screen has no WCAG A/AA violations`, async ({ page }) => {
      await launch(page);
      await gotoTab(page, name);
      await expectNoA11yViolations(page, `${name} screen`);
    });
  }

  test('the open bottom sheet has no WCAG A/AA violations and traps focus inside', async ({ page }) => {
    await launch(page);
    await openSheet(page);
    await expectNoA11yViolations(page, 'bottom sheet');
    await expect(sheet(page)).toHaveAttribute('aria-modal', 'true');
    // focus starts inside the dialog
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), 'focus stays in sheet').toBe(true);
  });

  test('tab bar is reachable and operable with the keyboard', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'keyboard navigation is a desktop behaviour');
    await launch(page);
    await primaryNav(page).getByRole('link').first().focus();
    await page.keyboard.press('Tab');
    await expect(primaryNav(page).getByRole('link', { name: /^collections$/i })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(primaryNav(page).getByRole('link', { name: /^collections$/i })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('contrast on every theme (blueprint 5.2, 19)', () => {
  for (const theme of THEME_NAMES) {
    test(`${theme}: axe color-contrast passes on every screen`, async ({ page }) => {
      await launch(page);
      await chooseTheme(page, theme);
      for (const name of TABS) {
        await gotoTab(page, name);
        await expectNoContrastViolations(page, `${theme} theme, ${name} screen`);
      }
    });

    test(`${theme}: rendered text and page colours match the blueprint and meet 4.5:1`, async ({ page }) => {
      await launch(page);
      await chooseTheme(page, theme);
      await gotoTab(page, 'Library');
      const painted = await page.evaluate(() => {
        const heading = document.querySelector('h1')!;
        // effective background: first non-transparent ancestor background
        let el: Element | null = heading;
        let bg = 'rgba(0, 0, 0, 0)';
        while (el) {
          bg = getComputedStyle(el).backgroundColor;
          if (!/rgba\(.*,\s*0\)$/.test(bg) && bg !== 'transparent') break;
          el = el.parentElement;
        }
        return { text: getComputedStyle(heading).color, bg };
      });
      expect(toHex(painted.bg), 'page colour').toBe(THEMES[theme].page.toUpperCase());
      expect(toHex(painted.text), 'text colour').toBe(THEMES[theme].text.toUpperCase());
      expect(contrastRatio(painted.text, painted.bg)).toBeGreaterThanOrEqual(4.5);
    });
  }

  test('contrast holds with the sheet open on the Dark theme', async ({ page }) => {
    await launch(page);
    await chooseTheme(page, 'dark');
    await installHelpButton(page).click();
    await expect(sheet(page)).toBeVisible();
    await expectNoContrastViolations(page, 'dark theme, sheet open');
  });
});
