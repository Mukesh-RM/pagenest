import { expect, test } from '@playwright/test';
import { TABS, gotoTab, launch, primaryNav, screenHeading, waitForServiceWorkerControl } from './support/app';

// Blueprint section 14: "pre-caches the app shell ... so the app opens offline instantly".
// Blueprint section 20: "launches offline in under 1 second".
const LAUNCH_BUDGET_MS = Number(process.env.PAGENEST_LAUNCH_BUDGET_MS ?? 1000);

test.describe('offline', () => {
  test('a service worker registers, activates and takes control after the first load', async ({ page }) => {
    await launch(page);
    await waitForServiceWorkerControl(page);
    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { active: reg.active?.state, scope: reg.scope };
    });
    expect(state.active).toBe('activated');
  });

  test('reload works offline after the first load', async ({ page, context }) => {
    await launch(page);
    await waitForServiceWorkerControl(page);

    await context.setOffline(true);
    await page.reload();
    await expect(primaryNav(page)).toBeVisible();
    await expect(screenHeading(page, 'Library')).toBeVisible();
    await context.setOffline(false);
  });

  test('every tab survives a reload while offline', async ({ page, context }) => {
    await launch(page);
    await waitForServiceWorkerControl(page);
    await context.setOffline(true);
    for (const name of TABS) {
      await gotoTab(page, name);
      await page.reload();
      await expect(screenHeading(page, name)).toBeVisible();
    }
    await context.setOffline(false);
  });

  test(`offline launch shows the library in under ${LAUNCH_BUDGET_MS} ms`, async ({ page, context }) => {
    await launch(page);
    await waitForServiceWorkerControl(page);
    await context.setOffline(true);
    await page.reload();
    await expect(screenHeading(page, 'Library')).toBeVisible();
    // performance.now() counts from the start of this navigation
    const shownAt = await page.evaluate(() => performance.now());
    expect(shownAt, `library visible after ${Math.round(shownAt)} ms`).toBeLessThan(LAUNCH_BUDGET_MS);
    await context.setOffline(false);
  });

  test('a fresh offline context cannot load the app, proving the tests really test the cache', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ offline: true });
    const page = await context.newPage();
    await expect(page.goto(baseURL!)).rejects.toThrow();
    await context.close();
  });
});
