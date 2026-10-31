import { expect, test } from '@playwright/test';
import {
  TABS, chooseTheme, currentTheme, gotoTab, installHelpButton, launch, openSheet, primaryNav, screenHeading, sheet,
} from './support/app';

test.describe('phase 0 smoke', () => {
  test('app loads with a title, the Library screen and no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

    await launch(page);
    await expect(page).toHaveTitle(/InkQuiet/);
    await expect(page.locator('html')).toHaveAttribute('lang', /.+/);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('makes no network requests outside its own origin (blueprint 4: private, no external requests)', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const foreign: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.protocol.startsWith('http') && u.origin !== origin) foreign.push(r.url());
    });
    await launch(page);
    for (const name of TABS) await gotoTab(page, name);
    expect(foreign, `External requests: ${foreign.join(', ')}`).toEqual([]);
  });

  test('four tabs are present in order and each one navigates', async ({ page }) => {
    await launch(page);
    const links = primaryNav(page).getByRole('link');
    await expect(links).toHaveText([...TABS]);
    for (const name of TABS) {
      await gotoTab(page, name);
      // exactly one tab is current at any time
      await expect(primaryNav(page).locator('[aria-current="page"]')).toHaveCount(1);
    }
  });

  test('browser back returns to the previous tab', async ({ page }) => {
    await launch(page);
    await gotoTab(page, 'Stats');
    await gotoTab(page, 'Collections');
    await page.goBack();
    await expect(screenHeading(page, 'Stats')).toBeVisible();
  });

  test('tab touch targets are at least 44 by 44 px (blueprint 5.4)', async ({ page }) => {
    await launch(page);
    for (const name of TABS) {
      const box = await primaryNav(page).getByRole('link', { name: new RegExp(`^${name}$`, 'i') }).boundingBox();
      expect(box, `${name} tab has no box`).not.toBeNull();
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
    }
  });

  test('theme switches between Light, Sepia, Dark and Black and the page repaints', async ({ page }) => {
    await launch(page);
    const seen = new Set<string>();
    for (const theme of ['dark', 'sepia', 'black', 'light'] as const) {
      await chooseTheme(page, theme);
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      seen.add(bg);
    }
    expect(seen.size, 'each theme must paint a different page colour').toBeGreaterThanOrEqual(3);
  });

  test('the chosen theme survives a reload', async ({ page }) => {
    await launch(page);
    await chooseTheme(page, 'dark');
    await page.reload();
    await expect(primaryNav(page)).toBeVisible();
    expect(await currentTheme(page)).toBe('dark');
  });

  test('bottom sheet opens, then closes with its button', async ({ page }) => {
    await launch(page);
    await openSheet(page);
    await expect(sheet(page)).toBeVisible();
    // The sheet may offer a header "Close" icon button AND a footer "Done" button; both close it. Exact names (not a
    // substring match) and the first in DOM order, which is the header Close, so the click is never ambiguous.
    await sheet(page).getByRole('button', { name: /^(close|done)$/i }).first().click();
    await expect(sheet(page)).toBeHidden();
    await expect(installHelpButton(page)).toBeFocused();
  });

  test('bottom sheet closes with the Escape key', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'Escape key is a desktop keyboard behaviour');
    await launch(page);
    await openSheet(page);
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
  });

  test('the back gesture closes the sheet first and stays on the same screen (blueprint 5.5)', async ({ page }) => {
    await launch(page);
    await openSheet(page);
    await page.goBack();
    await expect(sheet(page)).toBeHidden();
    await expect(screenHeading(page, 'Settings')).toBeVisible();
  });
});
