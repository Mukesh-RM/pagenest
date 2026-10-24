import { test, expect } from '@playwright/test';
import { expectNoVerticalOverlap, expectVisibleAndNotClipped } from './layout-helpers';

const listenHash = '#/listen/dev-fixture-audio';

test.describe('audiobook player harness', () => {
  test('immersive listen route shows full player and keeps controls', async ({ page }) => {
    await page.goto(`./index.html${listenHash}`);
    await expect(page.getByRole('heading', { name: /now playing/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect(page.getByText(/chapter-one|PageNest test tone/i)).toBeVisible();
  });

  test('mini-player slot hides on immersive route and returns on library', async ({ page }) => {
    await page.goto(`./index.html${listenHash}`);
    await expect(page.getByRole('heading', { name: /now playing/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: 'Mini player' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to Library' }).click();
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
    await expect(page.getByRole('heading', { name: /now playing/i })).toBeVisible({ timeout: 15_000 });

    const speedGroup = page.getByRole('group', { name: 'Playback speed' });
    await speedGroup.getByRole('button', { name: '2x', exact: true }).click();
    await expect(speedGroup.getByRole('button', { name: '2x', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('group', { name: 'Sleep timer' }).getByRole('button', { name: '15 min', exact: true }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Back to Library' }).click();
    const mini = page.getByRole('region', { name: 'Mini player' });
    await expect(mini).toBeVisible();
    await expect(mini.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

    await mini.getByRole('button', { name: /Open player/i }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Playback speed' }).getByRole('button', { name: '2x', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('player-sleep-active')).toBeVisible();
    await expect(page.getByTestId('player-speed-display')).toContainText('2');
  });

  test('time-left, speed and sleep controls stay readable at 200% text size', async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.goto(`./index.html${listenHash}`);
    await expect(page.getByRole('heading', { name: /now playing/i })).toBeVisible({ timeout: 15_000 });

    const timeRow = page.getByTestId('player-time-remaining');
    const speedSection = page.getByTestId('player-speed-section');
    const sleepSection = page.getByTestId('player-sleep-section');

    await expectVisibleAndNotClipped(timeRow, page);
    await expectVisibleAndNotClipped(page.getByTestId('player-speed-display'), page);
    await expectVisibleAndNotClipped(speedSection.getByRole('button', { name: '1.5x', exact: true }), page);
    await expectVisibleAndNotClipped(sleepSection.getByRole('button', { name: '30 min', exact: true }), page);

    await expectNoVerticalOverlap(timeRow, speedSection);
    await expectNoVerticalOverlap(speedSection, sleepSection);

    await expect(page.getByTestId('player-time-left')).toContainText('left');
    await expect(page.getByTestId('player-speed-display')).toContainText('x');
  });
});
