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

/** The first-run onboarding (src/app/onboarding): three cards, "Skip" on the first two, "Done" on the last. */
export function onboardingSkip(page: Page): Locator {
  return page.getByRole('button', { name: /^skip$/i });
}

/**
 * Gets past first-run onboarding if it is showing: clicks Skip, which stores `onboardingDone` in IndexedDB so it never
 * returns on this browser profile. Works whether or not the app has onboarding (the reference fixture has none).
 */
export async function skipOnboarding(page: Page): Promise<void> {
  const skip = onboardingSkip(page);
  await expect(skip.or(primaryNav(page)).first()).toBeVisible();
  if (await skip.isVisible()) {
    await skip.click();
    await expect(primaryNav(page)).toBeVisible();
  }
}

/** Opens the app at its start URL, skips onboarding, and waits for the library screen (the home tab). */
export async function launch(page: Page): Promise<void> {
  await page.goto('./');
  await skipOnboarding(page);
  await expect(primaryNav(page)).toBeVisible();
  await expect(screenHeading(page, 'Library')).toBeVisible();
}

/** Opens the app WITHOUT skipping onboarding. Only the dedicated onboarding tests use this. */
export async function launchFresh(page: Page): Promise<void> {
  await page.goto('./');
}

export function currentTheme(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.documentElement.dataset.theme);
}

/**
 * A theme option in Settings or onboarding. The app uses native radio inputs hidden behind a swatch label, so the label is
 * what a finger or mouse hits (and Playwright cannot click the 1 px input itself). Pass "Match my phone" for system.
 */
export function themeRadio(page: Page, name: string): Locator {
  return page.getByRole('radio', { name: new RegExp(`^${name}$`, 'i') });
}

export function themeOption(page: Page, name: string): Locator {
  return themeRadio(page, name).locator('xpath=ancestor::label[1]');
}

/** Chooses a theme in Settings (blueprint 5.2: Light, Sepia, Dark, Black). */
export async function chooseTheme(page: Page, theme: ThemeName): Promise<void> {
  await gotoTab(page, 'Settings');
  const radio = page.getByRole('radio', { name: new RegExp(`^${theme}$`, 'i') });
  // The radio input is visually hidden (sr-only) inside a themed card; its <label> receives the pointer.
  await page.locator('label', { has: radio }).click();
  await expect(radio).toBeChecked();
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
  // `ready` never settles when the app registers no service worker, so race it against a timeout and fail with a clear reason.
  await page.evaluate(async (timeoutMs) => {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are not supported');
    const none = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`No service worker became active within ${timeoutMs} ms (is one registered?)`)), timeoutMs));
    await Promise.race([navigator.serviceWorker.ready, none]);
  }, 8_000);
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  if (!controlled) {
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 15_000 });
  }
}
