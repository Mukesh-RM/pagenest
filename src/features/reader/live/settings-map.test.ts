import { describe, expect, it } from 'vitest';
import { DEFAULT_READER_SETTINGS, READER_FONTS } from '@/app/reader-settings';
import { LINE_HEIGHT } from '@/ui/screens';
import { READING_FONTS } from '../core/fonts';
import { normalizeAppearance } from '../core/appearance';
import { settingsToAppearance } from './settings-map';

describe('settings to appearance', () => {
  it('maps every Aa choice to the engine', () => {
    const a = settingsToAppearance({ ...DEFAULT_READER_SETTINGS, theme: 'sepia', fontSize: 22, lineSpacing: 'airy', margins: 'wide' });
    expect(a.theme).toBe('sepia');
    expect(a.fontSizePx).toBe(22);
    expect(a.lineHeight).toBe(LINE_HEIGHT.airy);
    expect(a.margins).toBe('wide');
  });

  it('turns the sheet\'s "medium" margin into the engine\'s "normal"', () => {
    expect(settingsToAppearance({ ...DEFAULT_READER_SETTINGS, margins: 'medium' }).margins).toBe('normal');
    expect(settingsToAppearance({ ...DEFAULT_READER_SETTINGS, margins: 'narrow' }).margins).toBe('narrow');
  });

  it.each(['light', 'sepia', 'dark', 'black'] as const)('keeps the %s theme', (theme) => {
    expect(settingsToAppearance({ ...DEFAULT_READER_SETTINGS, theme }).theme).toBe(theme);
  });

  it('every font the Aa sheet offers is a font the engine can draw', () => {
    for (const font of READER_FONTS) {
      const mapped = settingsToAppearance({ ...DEFAULT_READER_SETTINGS, fontId: font.id });
      const known = READING_FONTS.find((f) => f.id === font.id);
      expect(known, `engine font for "${font.id}"`).toBeDefined();
      expect(mapped.fontFamily).toBe(known?.family);
    }
  });

  it('falls back to the default font for an id it does not know', () => {
    expect(settingsToAppearance({ ...DEFAULT_READER_SETTINGS, fontId: 'nope' }).fontFamily).toBe(READING_FONTS[0]?.family);
  });

  it('maps page turn style', () => {
    expect(settingsToAppearance({ ...DEFAULT_READER_SETTINGS, pageTurn: 'scroll' }).pageTurn).toBe('scroll');
  });
    for (const fontSize of [14, 18, 32]) {
      const a = settingsToAppearance({ ...DEFAULT_READER_SETTINGS, fontSize });
      expect(normalizeAppearance(a)).toEqual(a);
    }
  });
});
