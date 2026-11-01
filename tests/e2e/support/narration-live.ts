import type { BrowserContext } from '@playwright/test';
import { expect, type Page } from '@playwright/test';

/** Simulates a pre–Web-Speech-default profile that still had Piper selected. */
export async function seedLegacyPiperNarrationSettings(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('pagenest');
      open.onerror = () => reject(open.error ?? new Error('indexedDB.open failed'));
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('settings', 'readwrite');
        tx.onerror = () => reject(tx.error ?? new Error('settings write failed'));
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.objectStore('settings').put({
          key: 'narrationSettings',
          value: {
            engine: 'piper',
            voiceId: 'en_US-libritts-high',
            speed: 1,
            style: 'natural',
            expressive: false,
          },
        });
      };
    });
  });
}

/** Headless Chromium/WebKit often ship no TTS voices; stub speech for live smoke UI checks. */
export async function primeDeviceSpeechForLiveSmoke(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as Window & { __pnSpeechSmoke?: boolean };
    if (w.__pnSpeechSmoke) return;
    w.__pnSpeechSmoke = true;
    const fakeVoices = [
      {
        name: 'English (United States)',
        lang: 'en-US',
        voiceURI: 'pn-smoke-en-us',
        default: true,
        localService: true,
      },
    ] as SpeechSynthesisVoice[];
    let speaking = false;
    let paused = false;
    let utterance: SpeechSynthesisUtterance | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const synth = window.speechSynthesis;
    const clearTimer = (): void => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };
    const finish = (): void => {
      clearTimer();
      speaking = false;
      paused = false;
      utterance = undefined;
    };

    synth.getVoices = () => fakeVoices;
    synth.speak = (u: SpeechSynthesisUtterance) => {
      synth.cancel();
      utterance = u;
      speaking = true;
      paused = false;
      const ms = Math.min(12_000, Math.max(400, u.text.length * 40));
      timer = setTimeout(() => {
        if (!paused) {
          u.onend?.({} as SpeechSynthesisEvent);
          finish();
        }
      }, ms);
    };
    synth.cancel = () => finish();
    synth.pause = () => {
      if (!speaking) return;
      paused = true;
      clearTimer();
    };
    synth.resume = () => {
      if (!utterance || !paused) return;
      paused = false;
      timer = setTimeout(() => {
        utterance?.onend?.({} as SpeechSynthesisEvent);
        finish();
      }, 350);
    };
    try {
      Object.defineProperty(synth, 'speaking', { configurable: true, get: () => speaking });
      Object.defineProperty(synth, 'paused', { configurable: true, get: () => paused });
    } catch {
      /* native getters may be read-only; speak stub still drives UI */
    }
    synth.dispatchEvent(new Event('voiceschanged'));
  });
}

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

/** Waits for read-aloud playback (HTML audio for HD voices, or speechSynthesis for device voices). */
export async function waitForReadAloudAudible(page: Page, timeoutMs = 120_000): Promise<void> {
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 5_000 }).catch(() => undefined);
  await expect.poll(
    async () =>
      page.evaluate(async () => {
        const pauseBtn = document.querySelector('button[aria-label="Pause read aloud"]');
        if (pauseBtn instanceof HTMLButtonElement && !pauseBtn.disabled) {
          return { ok: true, via: 'ui' as const };
        }
        const synth = window.speechSynthesis;
        if (synth?.speaking && !synth.paused) {
          return { ok: true, via: 'speech' as const };
        }
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
        return {
          ok: !audio.paused && (advanced || analyserEnergy > 48),
          via: 'audio' as const,
          paused: audio.paused,
          advanced,
          analyserEnergy,
          t0,
          t1: audio.currentTime,
        };
      }),
    { timeout: timeoutMs, intervals: [250, 500, 1000, 2000] },
  ).toMatchObject({ ok: true });
}

export async function exerciseReadAloudControls(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pause read aloud' }).click();
  await expect(page.getByRole('button', { name: 'Start read aloud' })).toBeVisible();
  await page.getByRole('button', { name: 'Start read aloud' }).click();
  await expect(page.getByRole('button', { name: 'Pause read aloud' })).toBeVisible();
  await page.getByRole('button', { name: '1.25×', exact: true }).click();
  await expect(page.getByRole('button', { name: '1.25×', exact: true })).toHaveAttribute('aria-pressed', 'true');
}
