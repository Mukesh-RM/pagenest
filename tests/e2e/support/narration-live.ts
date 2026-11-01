import { expect, type Page } from '@playwright/test';

export async function openReadAloudControls(page: Page): Promise<void> {
  const region = page.getByRole('region', { name: 'Read aloud controls' });
  if (await region.isVisible().catch(() => false)) return;
  await page.getByRole('button', { name: 'Read aloud' }).click();
  await expect(region).toBeVisible({ timeout: 15_000 });
}

export async function startDefaultReadAloud(page: Page): Promise<void> {
  await openReadAloudControls(page);
  const start = page.getByRole('button', { name: 'Start read aloud' });
  await expect(start).toBeVisible();
  await start.click();
}

/** Waits for Piper download + audible playback (AnalyserNode or position advance). */
export async function waitForReadAloudAudible(page: Page, timeoutMs = 480_000): Promise<void> {
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 5_000 }).catch(() => undefined);
  await expect.poll(
    async () =>
      page.evaluate(async () => {
        const audio = document.querySelector('audio');
        if (!audio) return { ok: false, reason: 'no-audio' };
        if (audio.paused) {
          try {
            await audio.play();
          } catch {
            /* gesture may already have started playback */
          }
        }
        const t0 = audio.currentTime;
        let analyserEnergy = 0;
        const capture = (audio as HTMLMediaElement & { captureStream?: () => MediaStream }).captureStream?.();
        if (capture) {
          const ctx = new AudioContext();
          try {
            await ctx.resume();
            const src = ctx.createMediaStreamSource(capture);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            const buf = new Uint8Array(analyser.frequencyBinCount);
            await new Promise((r) => setTimeout(r, 600));
            analyser.getByteTimeDomainData(buf);
            for (let i = 0; i < buf.length; i += 1) {
              const v = (buf[i] ?? 128) - 128;
              analyserEnergy += Math.abs(v);
            }
          } finally {
            void ctx.close();
          }
        }
        await new Promise((r) => setTimeout(r, 400));
        const advanced = audio.currentTime > t0 + 0.03;
        const session = navigator.mediaSession?.playbackState ?? '';
        return {
          ok: !audio.paused && (advanced || analyserEnergy > 48),
          paused: audio.paused,
          advanced,
          analyserEnergy,
          session,
          t0,
          t1: audio.currentTime,
        };
      }),
    { timeout: timeoutMs, intervals: [500, 1000, 2000, 4000] },
  ).toMatchObject({ ok: true });
}

export async function expectDownloadProgressVisible(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: /Downloading voice|Loading voice/i })).toBeVisible({ timeout: 120_000 });
}
