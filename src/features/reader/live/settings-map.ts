import type { ReaderAppearance } from '@/engines/reader/types';
import type { ReaderSettings } from '@/ui';
import { LINE_HEIGHT } from '@/ui/screens';
import { READING_FONTS } from '../core/fonts';
import { DEFAULT_APPEARANCE } from '../core/appearance';

/**
 * The app's saved reader settings (what the Aa sheet edits) as the engine's appearance. The font is chosen by id; ids
 * the engine does not know fall back to the default serif.
 */
export function settingsToAppearance(settings: ReaderSettings): ReaderAppearance {
  const font = READING_FONTS.find((f) => f.id === settings.fontId) ?? READING_FONTS[0];
  return {
    ...DEFAULT_APPEARANCE,
    theme: settings.theme,
    fontFamily: font?.family ?? DEFAULT_APPEARANCE.fontFamily,
    fontSizePx: settings.fontSize,
    lineHeight: LINE_HEIGHT[settings.lineSpacing],
    margins: settings.margins === 'medium' ? 'normal' : settings.margins,
  };
}
