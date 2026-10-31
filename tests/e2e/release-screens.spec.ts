import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { copyFileSync, existsSync } from 'node:fs';
import { chooseTheme, launch, gotoTab, skipOnboarding } from './support/app';

const OUT = join(process.cwd(), '..', 'docs', 'screens', 'release');
const VIEW = { width: 360, height: 740 };

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await chooseTheme(page, theme);
}

test.describe('release screenshots (360 px)', () => {
  test.skip(() => process.env.PAGENEST_RELEASE_SHOTS !== '1', 'Set PAGENEST_RELEASE_SHOTS=1 to capture docs/screens/release PNGs');

  test.beforeAll(() => {
    mkdirSync(OUT, { recursive: true });
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`library and settings (${theme})`, async ({ page }) => {
      await page.setViewportSize(VIEW);
      await launch(page);
      await setTheme(page, theme);
      await gotoTab(page, 'Library');
      await page.screenshot({ path: join(OUT, `library-360-${theme}.png`), fullPage: true });
      await gotoTab(page, 'Settings');
      await page.locator('#pn-set-voices').scrollIntoViewIfNeeded();
      await expect(page.getByRole('heading', { name: 'Voices', exact: true })).toBeVisible();
      await page.screenshot({ path: join(OUT, `settings-360-${theme}.png`), fullPage: true });
    });

    test(`reader with narration (${theme})`, async ({ page }) => {
      await page.setViewportSize(VIEW);
      await launch(page);
      await setTheme(page, theme);
      await gotoTab(page, 'Library');
      const card = page.getByRole('region', { name: /try a sample book/i });
      if (await card.isVisible().catch(() => false)) {
        await card.getByRole('button', { name: /add the sample book/i }).click();
      }
      const opened = await page.waitForURL(/\/read\//, { timeout: 15_000 }).then(() => true, () => false);
      if (!opened) {
        const book = page.getByRole('main').getByRole('button').filter({ hasText: /peter rabbit|sample/i }).first();
        await expect(book).toBeVisible({ timeout: 15_000 });
        await book.click();
        await expect(page).toHaveURL(/\/read\//, { timeout: 15_000 });
      }
      await expect(page.getByRole('region', { name: 'Read aloud controls' })).toBeVisible({ timeout: 20_000 });
      await page.screenshot({ path: join(OUT, `reader-narration-360-${theme}.png`), fullPage: true });
      await page.screenshot({ path: join(OUT, `reader-360-${theme}.png`), fullPage: true });
    });
  }

  test('audio player (light and dark)', async ({ page }) => {
    await page.setViewportSize(VIEW);
    await page.goto('./?pn_seed_audio=1');
    await skipOnboarding(page);
    await page.goto('./listen/pn-review-seed-audiobook?pn_seed_audio=1');
    await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: join(OUT, 'player-360-light.png'), fullPage: true });
    await page.goto('./settings');
    await page.getByRole('radio', { name: /^dark$/i }).locator('xpath=ancestor::label[1]').click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    await page.goto('./listen/pn-review-seed-audiobook?pn_seed_audio=1');
    await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: join(OUT, 'player-360-dark.png'), fullPage: true });
  });

  test('copy narration and voice-studio reference shots', () => {
    const copies: [string, string][] = [
      ['../docs/screens/narration/controls-light.png', 'narration-controls-360-light.png'],
      ['../docs/screens/narration/controls-expressive-speed.png', 'narration-controls-expressive-360.png'],
      ['../docs/screens/voice-studio/01-my-voices-empty.png', 'voice-studio-my-voices-360.png'],
      ['../docs/screens/voice-studio/02-consent-phrase.png', 'voice-studio-consent-360.png'],
    ];
    for (const [src, dest] of copies) {
      const from = join(process.cwd(), src);
      if (existsSync(from)) copyFileSync(from, join(OUT, dest));
    }
  });
});
