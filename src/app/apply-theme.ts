import { applyTextSize } from '@/ui/utils/textSize';
import { FONT_SIZE_DEFAULT } from './font-size';

/**
 * Apply the app text size (px at the 100 % default of 16) to the document root through the design
 * system's `applyTextSize`. It writes ONE property, `--pn-font-size`; `html` uses it as its font
 * size and every `--pn-text-*` token is `rem`, so the whole app scales together up to 200 % (32 px).
 * The app never writes px text tokens: a px override would stop the tokens following the setting and
 * would fight the user's browser font-size preference.
 */
export const applyFontSize: (px: number, root?: HTMLElement) => void = applyTextSize;

/** The text size as a percentage of the default, for labels ("125%"). */
export function fontScalePercent(px: number): number {
  return Math.round((px / FONT_SIZE_DEFAULT) * 100);
}
