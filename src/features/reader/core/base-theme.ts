import type { ReaderAppearance } from '@/engines/reader/types';
import type { ThemeName } from '@/ui/theme/themes';
import { themeColors } from './appearance';

/** The theme the reader chrome is built on: the chosen theme, or light/dark for a custom one. */
export function baseThemeFor(appearance: ReaderAppearance): ThemeName {
  if (appearance.theme !== 'custom') return appearance.theme;
  return themeColors(appearance).scheme === 'dark' ? 'dark' : 'light';
}
