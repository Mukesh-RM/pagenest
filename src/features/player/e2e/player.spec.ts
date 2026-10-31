import { test, expect } from '@playwright/test';
import { expectNoVerticalOverlap, expectVisibleAndNotClipped } from './layout-helpers';

const listenHash = '#/listen/pn-review-seed-audiobook';

test.describe('audiobook player harness', () => {
  test('immersive listen route shows full player and keeps controls', async ({ page }) => {
    await page.goto(`./index.html${listenHash}`);
    await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /Extraordinarily Long Title/i })).toBeVisible();
  });

  test('mini-player slot hides on immersive route and returns on library', async ({ page }) => {
    await page.goto(`./index.html${listenHash}`);
    await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: 'Mini player' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Minimize player' }).click();
    await expect(page.getByRole('region', { name: 'Mini player' })).toBeVisible();
  });

  test('keyboard shortcut k toggles play/pause on immersive player', async ({ page }) => {
    await page.goto(`./index.html${listenHash}`);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await page.keyboard.press('k');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  });

  test('playback state survives immersive chrome and mini-player remount', async ({ page }) => {
    await page.goto(`./index.html${listenHash}`);
    await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 15_000 });

    const speedChip = page.getByRole('button', { name: /Speed.*Change speed/i });
    let speedText = await speedChip.textContent();
    for (let i = 0; i < 12 && !/2(\.|×|x)/.test(speedText ?? ''); i += 1) {
      await speedChip.click();
      speedText = await speedChip.textContent();
    }

    await page.getByRole('button', { name: /Sleep timer/i }).click();
    await page.getByRole('button', { name: '15 min', exact: true }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Minimize player' }).click();
    const mini = page.getByRole('region', { name: 'Mini player' });
    await expect(mini).toBeVisible();
    await expect(mini.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

    await mini.getByRole('button', { name: /Open player/i }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sleep timer: 15 min/i })).toBeVisible();
  });

  test('time-left line and sleep controls stay readable at 200% text size', async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.goto(`./index.html${listenHash}`);
    await expect(page.getByRole('region', { name: 'Audio player' })).toBeVisible({ timeout: 15_000 });

    const timeLeft = page.locator('.pn-player__left');
    const sleepChip = page.getByRole('button', { name: /Sleep timer/i });
    await expectVisibleAndNotClipped(timeLeft, page);
    await expectVisibleAndNotClipped(sleepChip, page);
    await expectNoVerticalOverlap(timeLeft, sleepChip);
    await expect(timeLeft).toContainText(/left|At this speed/i);
  });
});
