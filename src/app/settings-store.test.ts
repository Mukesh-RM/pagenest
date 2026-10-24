import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageNestDB } from '@/data/db';
import { getSetting } from '@/data/settings';
import { FONT_SIZE_SAVE_DELAY_MS, flushSettings, useSettings } from './settings-store';
import { resetSettings } from './test-utils';

let db: PageNestDB;
let n = 0;

beforeEach(() => {
  db = new PageNestDB(`settings-store-${(n += 1)}`);
  resetSettings();
});

afterEach(async () => {
  vi.useRealTimers();
  await flushSettings();
  db.close();
  await db.delete();
});

describe('font size saving', () => {
  it('applies every change to the store at once but writes to the database once, after the slider rests', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const put = vi.spyOn(db.settings, 'put');
    const { setFontSizePx } = useSettings.getState();

    const saves = [18, 19, 20, 21, 22].map((px) => setFontSizePx(db, px));
    expect(useSettings.getState().fontSizePx).toBe(22);
    expect(put).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(FONT_SIZE_SAVE_DELAY_MS - 1);
    expect(put).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    await Promise.all(saves);

    expect(put).toHaveBeenCalledTimes(1);
    expect(await getSetting(db, 'fontSizePx')).toBe(22);
  });

  it('flushSettings writes a pending size immediately and resolves the waiting calls', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const saved = useSettings.getState().setFontSizePx(db, 20);
    await flushSettings();
    await saved;
    expect(await getSetting(db, 'fontSizePx')).toBe(20);
  });

  it('flushSettings with nothing pending does nothing', async () => {
    await expect(flushSettings()).resolves.toBeUndefined();
  });

  it('finishing onboarding saves a pending text size first', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    void useSettings.getState().setFontSizePx(db, 23);
    await useSettings.getState().completeOnboarding(db);
    expect(await getSetting(db, 'fontSizePx')).toBe(23);
    expect(await getSetting(db, 'onboardingDone')).toBe(true);
  });
});
