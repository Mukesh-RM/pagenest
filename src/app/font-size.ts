import { clampTextSize, TEXT_SIZE_DEFAULT, TEXT_SIZE_MAX, TEXT_SIZE_MIN } from '@/ui/utils/textSize';

/**
 * App text size (blueprint 5.8, "dynamic text size"). One setting, stored in
 * Dexie as `fontSizePx`, drives the root font size, so everything sized in
 * `rem` scales together. The range runs from 88 % to 200 % of the 16 px
 * default; the design system's layouts are checked at 200 % on a 360 px screen. The reader has
 * its own, separate size setting (`ReaderSettings.fontSize`).
 */
export const FONT_SIZE_MIN = TEXT_SIZE_MIN;
export const FONT_SIZE_MAX = TEXT_SIZE_MAX;
export const FONT_SIZE_DEFAULT = TEXT_SIZE_DEFAULT;

/** Round to a whole pixel and keep inside the allowed range. NaN gives the default. */
export const clampFontSize = clampTextSize;

/** Read a saved value: a finite number is clamped, anything else is rejected with `undefined`. */
export function parseSavedFontSize(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? clampFontSize(value) : undefined;
}
