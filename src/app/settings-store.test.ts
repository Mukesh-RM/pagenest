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

describe('theme preference and the custom theme', () => {
  it('saves the Custom preference and its three colors, and a fresh store reads them back', async () => {
    const colors = { page: '#102030', text: '#f0f0f0', accent: '#ffcc00' };
    await useSettings.getState().setThemePreference(db, 'custom');
    await useSettings.getState().setCustomTheme(db, colors);
    expect(await getSetting(db, 'appTheme')).toBe('custom');
    expect(await getSetting(db, 'customTheme')).toEqual(colors);

    resetSettings();
    expect(useSettings.getState().themePreference).toBe('system');
    await useSettings.getState().load(db);
    expect(useSettings.getState().themePreference).toBe('custom');
    expect(useSettings.getState().customTheme).toEqual(colors);
  });

  it('keeps the default colors when the saved custom theme is damaged, and rejects an unknown preference', async () => {
    const defaults = useSettings.getState().customTheme;
    await db.settings.bulkPut([
      { key: 'appTheme', value: 'neon' },
      { key: 'customTheme', value: { page: 'red', text: 3 } },
    ]);
    await useSettings.getState().load(db);
    expect(useSettings.getState().themePreference).toBe('system');
    expect(useSettings.getState().customTheme).toEqual(defaults);
  });

  it('reaches 200 %: a saved 32 px is kept and 40 px is clamped to 32', async () => {
    await useSettings.getState().setFontSizePx(db, 40);
    expect(useSettings.getState().fontSizePx).toBe(32);
    await flushSettings();
    expect(await getSetting(db, 'fontSizePx')).toBe(32);
  });
});
