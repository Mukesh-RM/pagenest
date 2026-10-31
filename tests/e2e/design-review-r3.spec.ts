import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import { launchFresh, skipOnboarding, themeOption, gotoTab, launch } from './support/app';
import { seedLibrary } from './support/library';

async function dismissTransientUi(page: Page): Promise<void> {
  const gotIt = page.getByRole('button', { name: /^got it$/i });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
}

async function waitForLibraryBook(page: Page, title: string | RegExp): Promise<void> {
  await dismissTransientUi(page);
  const pattern = title instanceof RegExp ? title : new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  await expect(page.getByRole('main').getByRole('button', { name: pattern }).first()).toBeVisible({ timeout: 20_000 });
}

/** Must match `SEED_AUDIO_BOOK_ID` in src/features/player/seed/seed-audiobook.ts */
const SEED_AUDIO_BOOK_ID = 'pn-review-seed-audiobook';

/** light, sepia, dark, black, custom (blueprint 5.2). */
const THEMES = ['light', 'sepia', 'dark', 'black', 'custom'] as const;
const WIDTHS = [360, 430] as const;
const phase = process.env.DESIGN_R3_PHASE === 'before' ? 'before' : 'after';
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(repoRoot, 'docs', 'screens', 'r3', phase);

function shotPath(screen: string, width: number, theme: string): string {
  return join(OUT, `${screen}-${width}-${theme}.png`);
}

async function waitForSettingsStore(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open('pagenest');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => resolve(req.result);
        });
        try {
          if (!db.objectStoreNames.contains('settings')) {
            db.close();
            await sleep(50);
            continue;
          }
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('settings', 'readonly');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
          db.close();
          return true;
        } catch {
          db.close();
          await sleep(50);
        }
      } catch {
        await sleep(50);
      }
    }
    return false;
  }, null, { timeout: 60_000 });
}

async function writeSettingsOnboardingCustomTheme(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open('pagenest');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => resolve(req.result);
        });
        if (!db.objectStoreNames.contains('settings')) {
          db.close();
          await sleep(50);
          continue;
        }
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('settings', 'readwrite');
          const store = tx.objectStore('settings');
          store.put({ key: 'appTheme', value: 'custom' });
          store.put({
            key: 'customTheme',
            value: { page: '#1e2230', text: '#ebe7f2', accent: '#b9a7f5' },
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        db.close();
        return true;
      } catch {
        await sleep(50);
      }
    }
    return false;
  }, null, { timeout: 60_000 });
}

async function setAppTheme(page: Page, theme: (typeof THEMES)[number], opts?: { onboarding?: boolean }): Promise<void> {
  if (theme === 'custom') {
    if (opts?.onboarding) {
      await waitForSettingsStore(page);
      await writeSettingsOnboardingCustomTheme(page);
      await page.reload();
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('custom');
      return;
    }
    await launch(page);
    await gotoTab(page, 'Settings');
    await themeOption(page, 'Custom').click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('custom');
    await page.goto('./');
    await expect(page.getByRole('heading', { name: /^library$/i })).toBeVisible();
    return;
  }
  await waitForSettingsStore(page);
  await page.evaluate(async (t) => {
    const open = indexedDB.open('pagenest');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ key: 'appTheme', value: t });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, theme);
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
}

async function resetProfile(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('pagenest');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
    localStorage.clear();
  });
}

async function pastOnboarding(page: Page): Promise<void> {
  await resetProfile(page);
  await launchFresh(page);
  await skipOnboarding(page);
}

async function finishOnboarding(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const open = indexedDB.open('pagenest');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onupgradeneeded = () => {
        /* app will upgrade on reload */
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    if (db.objectStoreNames.contains('settings')) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put({ key: 'onboardingDone', value: true });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
  });
}

async function capture(page: Page, screen: string, width: number, theme: string): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  await dismissTransientUi(page);
  await page.screenshot({ path: shotPath(screen, width, theme), fullPage: true });
}

test.describe(`Design Review 3 screenshots (${phase})`, () => {
  test.setTimeout(120_000);

  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`onboarding-welcome ${width}px ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await resetProfile(page);
        await launchFresh(page);
        await setAppTheme(page, theme, { onboarding: true });
        await launchFresh(page);
        await expect(page.getByRole('heading', { name: /your books, your voice/i })).toBeVisible();
        await capture(page, 'onboarding-welcome', width, theme);
      });

      test(`onboarding-home ${width}px ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await resetProfile(page);
        await launchFresh(page);
        await setAppTheme(page, theme, { onboarding: true });
        await launchFresh(page);
        await page.getByRole('button', { name: /^next$/i }).click();
        await expect(page.getByRole('heading', { name: /home for your books/i })).toBeVisible();
        await capture(page, 'onboarding-home', width, theme);
      });

      test(`first-launch ${width}px ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await pastOnboarding(page);
        await setAppTheme(page, theme);
        await expect(page.getByRole('heading', { name: /your library is empty/i })).toBeVisible({ timeout: 20_000 });
        await capture(page, 'first-launch', width, theme);
      });

      test(`library-grid ${width}px ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await pastOnboarding(page);
        await seedLibrary(page, { count: 12 });
        await setAppTheme(page, theme);
        await waitForLibraryBook(page, 'Book 00001');
        await capture(page, 'library-grid', width, theme);
      });

      test(`library-list ${width}px ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await pastOnboarding(page);
        await seedLibrary(page, { count: 12 });
        await page.evaluate(() => {
          localStorage.setItem('library.prefs', JSON.stringify({ view: 'list', sort: 'recent' }));
        });
        await setAppTheme(page, theme);
        await waitForLibraryBook(page, 'Book 00001');
        await capture(page, 'library-list', width, theme);
      });

      test(`welcome-back ${width}px ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await pastOnboarding(page);
        await seedLibrary(page, { count: 3 });
        await finishOnboarding(page);
        await page.goto('./');
        await setAppTheme(page, theme);
        await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 20_000 });
        await capture(page, 'welcome-back', width, theme);
      });

      test(`book-detail ${width}px ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await pastOnboarding(page);
        await page.goto(`./listen/${SEED_AUDIO_BOOK_ID}?pn_seed_audio=1`);
        await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 30_000 });
        await page.goto('./');
        await setAppTheme(page, theme);
        await waitForLibraryBook(page, /Extraordinarily Long Title/i);
        const card = page.getByRole('button', { name: /Extraordinarily Long Title/i }).first();
        await card.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await capture(page, 'book-detail', width, theme);
      });

      test(`reader-chrome ${width}px ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await pastOnboarding(page);
        await setAppTheme(page, theme);
        const add = page.getByRole('button', { name: 'Add the sample book' });
        await expect(add).toBeVisible({ timeout: 20_000 });
        await add.click();
        await expect(page.getByRole('button', { name: 'Back to library' }).first()).toBeVisible({ timeout: 90_000 });
        await capture(page, 'reader-chrome', width, theme);
      });

      test(`audio-player ${width}px ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await pastOnboarding(page);
        await setAppTheme(page, theme);
        await page.goto(`./listen/${SEED_AUDIO_BOOK_ID}?pn_seed_audio=1`);
        await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 30_000 });
        await capture(page, 'audio-player', width, theme);
      });
    }
  }
});
