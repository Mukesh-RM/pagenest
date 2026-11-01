import { expect, type Page } from '@playwright/test';

export async function openReadAloudControls(page: Page): Promise<void> {
  const region = page.getByRole('region', { name: 'Read aloud controls' });
  if (await region.isVisible().catch(() => false)) return;
  await page.getByRole('button', { name: 'Read aloud' }).click();
  await expect(region).toBeVisible({ timeout: 15_000 });
}

export async function pickNarrationVoice(page: Page, voiceName: string): Promise<void> {
  await page.getByRole('button', { name: 'Choose voice' }).click();
  await expect(page.getByRole('dialog', { name: 'Read-aloud voice' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(voiceName, 'i') }).click();
  await expect(page.getByRole('dialog', { name: 'Read-aloud voice' })).toBeHidden({ timeout: 10_000 });
}

/** Waits for Piper download + first synthesized audio (position advances). */
export async function waitForNarrationAudible(page: Page, timeoutMs = 480_000): Promise<void> {
  const play = page.getByRole('button', { name: /^(Start read aloud|Pause read aloud)$/ });
  await expect(play).toBeEnabled({ timeout: timeoutMs });
  if (await play.getAttribute('aria-label') === 'Start read aloud') {
    await play.click();
  }
  await expect.poll(
    async () =>
      page.evaluate(async () => {
        const audio = document.querySelector('audio');
        if (!audio) return { ok: false, reason: 'no-audio-element' };
        if (audio.paused) {
          try {
            await audio.play();
          } catch {
            /* autoplay policy */
          }
        }
        const t0 = audio.currentTime;
        await new Promise((r) => setTimeout(r, 900));
        const advanced = audio.currentTime > t0 + 0.04;
        const session = typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession.playbackState : '';
        return {
          ok: !audio.paused && advanced,
          paused: audio.paused,
          advanced,
          session,
          t0,
          t1: audio.currentTime,
        };
      }),
    { timeout: timeoutMs, intervals: [500, 1000, 2000] },
  ).toMatchObject({ ok: true });
}

export async function exerciseNarrationControls(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pause read aloud' }).click();
  await expect(page.getByRole('button', { name: 'Start read aloud' })).toBeVisible();
  await page.getByRole('button', { name: 'Start read aloud' }).click();
  await expect(page.getByRole('button', { name: 'Pause read aloud' })).toBeVisible();

  await page.getByRole('button', { name: '1.25×', exact: true }).click();
  await expect(page.getByRole('button', { name: '1.25×', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: /Sleep timer:/ }).click();
  await expect(page.getByRole('dialog', { name: 'Sleep timer' })).toBeVisible();
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await expect(page.getByTestId('player-sleep-active')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Open drive mode' }).click();
  await expect(page.getByRole('dialog', { name: 'Drive mode' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Exit', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Drive mode' })).toBeHidden({ timeout: 10_000 });
}

/** Open a blank tab so the reader tab is backgrounded; narration should keep playing. */
export async function expectNarrationSurvivesBackground(page: Page, context: { newPage: () => Promise<Page> }): Promise<void> {
  const before = await page.evaluate(() => document.querySelector('audio')?.currentTime ?? 0);
  const blank = await context.newPage();
  await blank.goto('about:blank');
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => {
    const audio = document.querySelector('audio');
    return { paused: audio?.paused ?? true, t: audio?.currentTime ?? 0, session: navigator.mediaSession?.playbackState ?? '' };
  });
  expect(after.paused, 'audio paused in background tab').toBe(false);
  expect(after.t, 'playback position in background').toBeGreaterThan(before + 0.05);
  await blank.close();
}
