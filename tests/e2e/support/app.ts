import { expect, type Locator, type Page } from '@playwright/test';
import type { ThemeName } from './contrast';

/**
 * Selector contract for the PageNest shell. Everything is found through ARIA roles and visible names
 * (blueprint section 5.5, 5.6 and 5.8), never through CSS classes, so the app can restyle freely.
 * The contract is documented in tests/README.md and is what the reference fixture implements.
 */
export const TABS = ['Library', 'Collections', 'Stats', 'Settings'] as const;
export type TabName = (typeof TABS)[number];

/** The page-level navigation: bottom bar on phones, left rail on tablet and desktop (blueprint 5.5). */
export function primaryNav(page: Page): Locator {
  return page.getByRole('navigation', { name: /primary|main|tabs/i }).first();
}

export function tab(page: Page, name: TabName): Locator {
  return primaryNav(page).getByRole('link', { name: new RegExp(`^${name}$`, 'i') });
}

export function screenHeading(page: Page, name: TabName): Locator {
  return page.getByRole('heading', { level: 1, name: new RegExp(`^${name}$`, 'i') });
}

export async function gotoTab(page: Page, name: TabName): Promise<void> {
  await tab(page, name).click();
  await expect(tab(page, name)).toHaveAttribute('aria-current', 'page');
  await expect(screenHeading(page, name)).toBeVisible();
}

/** Opens the app at its start URL and waits for the library screen (the home tab). */
export async function launch(page: Page): Promise<void> {
  await page.goto('./');
  await expect(primaryNav(page)).toBeVisible();
  await expect(screenHeading(page, 'Library')).toBeVisible();
}

export function currentTheme(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.documentElement.dataset.theme);
}

/** Chooses a theme in Settings through the "Theme" radio group (blueprint 5.2: Light, Sepia, Dark, Black). */
export async function chooseTheme(page: Page, theme: ThemeName): Promise<void> {
  await gotoTab(page, 'Settings');
  const radio = page.getByRole('radio', { name: new RegExp(`^${theme}$`, 'i') });
  await radio.check();
  await expect.poll(() => currentTheme(page)).toBe(theme);
}

/** The Phase 0 bottom sheet: Settings > "Install help" opens a dialog (blueprint 5.5 and 5.6). */
export function installHelpButton(page: Page): Locator {
  return page.getByRole('button', { name: /install help/i });
}

export function sheet(page: Page): Locator {
  return page.getByRole('dialog');
}

export async function openSheet(page: Page): Promise<void> {
  await gotoTab(page, 'Settings');
  await installHelpButton(page).click();
  await expect(sheet(page)).toBeVisible();
}

/**
 * Resolves once the service worker is active AND controls the page. If the worker was installed during this
 * very load, a reload is needed before it controls the page, so we do exactly that once.
 */
export async function waitForServiceWorkerControl(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are not supported');
    await navigator.serviceWorker.ready;
  });
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  if (!controlled) {
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 15_000 });
  }
}
