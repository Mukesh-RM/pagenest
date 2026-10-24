import { test, expect, type Page } from '@playwright/test';
/** Must match `SEED_AUDIO_BOOK_ID` in src/features/player/seed/seed-audiobook.ts */
const SEED_AUDIO_BOOK_ID = 'pn-review-seed-audiobook';
import { skipOnboarding } from './support/app';

const themes = ['light', 'sepia', 'dark', 'black'] as const;

async function openSeedPlayer(page: Page): Promise<void> {
  await page.goto(`./?pn_seed_audio=1`);
  await skipOnboarding(page);
  await page.goto(`./listen/${SEED_AUDIO_BOOK_ID}?pn_seed_audio=1`);
  await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 30_000 });
}

test.describe('integrated audio player', () => {
  test.beforeEach(async ({ page }) => {
    await openSeedPlayer(page);
  });

  test('listen route loads seeded audiobook with cover and title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Extraordinarily Long Title/i })).toBeVisible();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  });

  test('mini-player persists after minimizing immersive player', async ({ page }) => {
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'Minimize player' }).click();
    const mini = page.getByRole('region', { name: 'Mini player' });
    await expect(mini).toBeVisible();
    await page.getByRole('link', { name: 'Library', exact: true }).click();
    await expect(mini).toBeVisible();
    await expect(mini.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  });

  test('prefers-reduced-motion skips FLIP class on player art', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 30_000 });
    const art = page.locator('.pn-player__art');
    await expect(art).toBeVisible();
  });
});

test.describe('audio player screenshots', () => {
  for (const theme of themes) {
    for (const width of [360, 430]) {
      test(`player ${width}px ${theme}`, async ({ page }) => {
        await page.addInitScript((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`./?pn_seed_audio=1`);
        await skipOnboarding(page);
        await page.goto(`./listen/${SEED_AUDIO_BOOK_ID}?pn_seed_audio=1`);
        await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 30_000 });
        await page.screenshot({
          path: `docs/screens/audio/player-${width}-${theme}.png`,
          fullPage: true,
        });
      });

      test(`mini-player ${width}px ${theme}`, async ({ page }) => {
        await page.addInitScript((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`./?pn_seed_audio=1`);
        await skipOnboarding(page);
        await page.goto(`./listen/${SEED_AUDIO_BOOK_ID}?pn_seed_audio=1`);
        await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 30_000 });
        await page.getByRole('button', { name: 'Play', exact: true }).click();
        await page.getByRole('button', { name: 'Minimize player' }).click();
        await page.getByRole('link', { name: 'Library', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Mini player' })).toBeVisible();
        await page.screenshot({
          path: `docs/screens/audio/mini-player-${width}-${theme}.png`,
          fullPage: false,
        });
      });
    }
  }
});
