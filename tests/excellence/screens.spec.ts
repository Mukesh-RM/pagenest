import { expect, test, type Page } from '@playwright/test';
import { TABS, chooseTheme, gotoTab, launch, openSheet, primaryNav, sheet, tab, themeOption, themeRadio, waitForServiceWorkerControl, type TabName } from '../e2e/support/app';
import { expectNoA11yViolations, expectNoContrastViolations } from '../e2e/support/axe';
import {
  applyTextScale, expectControlsReachable, expectNoOverflow, expectUsableLayout, expectTargetsBigEnough, longestMotion, readCls, recordLayoutShift,
} from '../e2e/support/layout';
import { BUDGETS } from '../perf/budgets';

// Mukeshh's product excellence bar, gates per screen (see perf/budgets.ts, "excellence"). Chromium, phone profile.
const X = BUDGETS.excellence;

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`); });
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  return problems;
}

test.describe('five themes (blueprint 5.2)', () => {
  test('Settings offers all five themes: Light, Sepia, Dark, Black and Custom', async ({ page }) => {
    await launch(page);
    await gotoTab(page, 'Settings');
    const offered = await page.getByRole('radio').evaluateAll((els) =>
      els.map((el) => ((el as HTMLInputElement).labels?.[0]?.textContent ?? el.getAttribute('aria-label') ?? '').trim()));
    const names = offered.map((n) => n.toLowerCase());
    for (const theme of X.themes) {
      expect(names, `Theme "${theme}" is not offered in Settings. Offered: ${JSON.stringify(offered)}. Blueprint 5.2 lists five themes (Custom: "You pick").`).toContain(theme.toLowerCase());
    }
  });

  test('Custom theme: contrast is AA on every screen', async ({ page }) => {
    await launch(page);
    await gotoTab(page, 'Settings');
    const custom = themeRadio(page, 'Custom');
    await expect(custom, 'No "Custom" theme option (blueprint 5.2); the app exposes only four themes').toHaveCount(1);
    await themeOption(page, 'Custom').click();
    for (const name of TABS) {
      await gotoTab(page, name);
      await expectNoContrastViolations(page, `custom theme, ${name} screen`);
    }
  });
});

for (const theme of ['light', 'sepia', 'dark', 'black'] as const) {
  test(`${theme}: every screen is axe-clean (all WCAG A and AA rules) with zero console problems`, async ({ page }) => {
    const problems = watchConsole(page);
    await launch(page);
    await chooseTheme(page, theme);
    for (const name of TABS) {
      await gotoTab(page, name);
      await expectNoA11yViolations(page, `${theme} theme, ${name} screen`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

test.describe('200% text size', () => {
  for (const name of TABS) {
    test(`${name}: nothing clipped, no horizontal scroll, controls reachable, axe clean`, async ({ page }) => {
      await launch(page);
      await gotoTab(page, name);
      const bodyPx = await applyTextScale(page, X.textScalePercent / 100);
      expect(bodyPx, 'body font size after scaling (16 px x 2)').toBeGreaterThanOrEqual(31);
      const label = `${name} at ${X.textScalePercent}% text`;
      await expectNoOverflow(page, label);
      await expect(primaryNav(page), 'navigation stays visible').toBeVisible();
      await expect(tab(page, name), 'current tab stays reachable').toBeInViewport();
      await expectControlsReachable(page, label);
      await expectNoA11yViolations(page, label);
    });
  }

  test('the in-app text size setting can reach 200% (blueprint 5.8: dynamic text size)', async ({ page }) => {
    await launch(page);
    await gotoTab(page, 'Settings');
    const slider = page.getByRole('slider').first();
    await expect(slider, 'Settings has no text size control').toBeVisible();
    await slider.focus();
    await page.keyboard.press('End'); // a range input jumps to its maximum
    await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))).toBeGreaterThan(16);
    const px = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    expect(px / 16, `largest in-app text size is ${px} px = ${Math.round((px / 16) * 100)}% of default; the bar asks for 200%`).toBeGreaterThanOrEqual(X.textScalePercent / 100);
  });

  test('the Install help sheet works at 200% text size', async ({ page }) => {
    await launch(page);
    await applyTextScale(page, X.textScalePercent / 100);
    await openSheet(page);
    await expectNoOverflow(page, 'install sheet at 200% text');
    const box = await sheet(page).boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.x, 'sheet inside viewport (left)').toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width, 'sheet inside viewport (right)').toBeLessThanOrEqual(vp.width + 1);
    await expectControlsReachable(page, 'install sheet at 200% text');
    await expectNoA11yViolations(page, 'install sheet at 200% text');
  });
});

test.describe('viewports (phones and laptops)', () => {
  for (const vp of X.viewports) {
    test.describe(vp.name, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        ...(vp.phone ? {} : { isMobile: false, hasTouch: false, deviceScaleFactor: 1 }),
      });

      for (const name of TABS) {
        test(`${name}: no horizontal overflow, usable layout, layout shift under ${X.maxCls}${vp.phone ? `, ${X.minTargetPx} px targets` : ''}`, async ({ page }) => {
          await recordLayoutShift(page);
          await launch(page);
          await gotoTab(page, name as TabName);
          await page.waitForTimeout(1000); // let late content (fonts, storage figures) settle before judging shifts
          const label = `${name} at ${vp.name} (${vp.width}x${vp.height})`;
          await expectNoOverflow(page, label);
          if (vp.phone) await expectTargetsBigEnough(page, X.minTargetPx, label);
          await expectUsableLayout(page, vp, label, X.minContentShareOfWidth);
          const { cls, shifts } = await readCls(page);
          expect(cls, `${label}: CLS ${cls.toFixed(3)} (limit ${X.maxCls}); shifts ${JSON.stringify(shifts)}`).toBeLessThan(X.maxCls);
        });
      }

      test('cold load and walking through every tab keeps total layout shift under the limit', async ({ page }) => {
        await recordLayoutShift(page);
        await launch(page);
        for (const name of [...TABS, ...TABS]) await gotoTab(page, name);
        await page.waitForTimeout(500);
        const { cls, shifts } = await readCls(page);
        expect(cls, `${vp.name}: CLS ${cls.toFixed(3)} (limit ${X.maxCls}); shifts ${JSON.stringify(shifts)}`).toBeLessThan(X.maxCls);
      });
    });
  }
});

test.describe('reduced motion is respected', () => {
  test.use({ reducedMotion: 'reduce' });

  test(`no transition or animation runs longer than ${X.reducedMotionMaxMs} ms on any screen`, async ({ page }) => {
    await launch(page);
    for (const name of TABS) {
      await gotoTab(page, name);
      const m = await longestMotion(page);
      expect(m.ms, `${name}: longest motion ${m.ms} ms at ${m.where}`).toBeLessThanOrEqual(X.reducedMotionMaxMs);
    }
    // while a change is happening, not only at rest
    await gotoTab(page, 'Settings');
    await themeOption(page, 'Dark').click();
    const during = await longestMotion(page);
    expect(during.ms, `theme change: longest motion ${during.ms} ms at ${during.where}`).toBeLessThanOrEqual(X.reducedMotionMaxMs);
  });

  test(`opening and closing the sheet has no motion over ${X.reducedMotionMaxMs} ms`, async ({ page }) => {
    await launch(page);
    await openSheet(page);
    const open = await longestMotion(page);
    expect(open.ms, `sheet open: longest motion ${open.ms} ms at ${open.where}`).toBeLessThanOrEqual(X.reducedMotionMaxMs);
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
  });
});

test.describe('offline and console', () => {
  test('every screen reloads offline with zero console problems', async ({ page, context }) => {
    const problems = watchConsole(page);
    await launch(page);
    await waitForServiceWorkerControl(page);
    problems.length = 0; // judge the offline reloads only; the online first load is checked below
    await context.setOffline(true);
    for (const screen of X.screens) {
      await page.goto(screen.path.replace(/^\//, './'));
      await expect(page.getByRole('heading', { level: 1, name: new RegExp(`^${screen.name}$`, 'i') }), `${screen.name} offline`).toBeVisible();
    }
    await context.setOffline(false);
    expect(problems.filter((p) => !/net::ERR_INTERNET_DISCONNECTED/.test(p)), problems.join('\n')).toEqual([]);
  });

  test('first online load and every screen produce zero console errors or warnings and no failed requests', async ({ page }) => {
    const problems = watchConsole(page);
    await launch(page);
    for (const name of TABS) await gotoTab(page, name);
    await page.waitForTimeout(500);
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
