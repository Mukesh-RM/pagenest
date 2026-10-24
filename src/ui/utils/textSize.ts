/**
 * App text size (blueprint 5.8, "dynamic text size"): 14 px up to 32 px on a 16 px base, that is 87.5% to 200%.
 * One number drives everything: the root font size, and every rem size follows. Pure helpers plus one DOM writer, so
 * the app's settings store and the design system agree on the limits.
 */
export const TEXT_SIZE_MIN = 14;
export const TEXT_SIZE_MAX = 32;
export const TEXT_SIZE_DEFAULT = 16;
export const TEXT_SIZE_STEP = 1;

/** Round to a whole pixel and keep inside the allowed range. NaN gives the default. */
export function clampTextSize(value: number): number {
  if (Number.isNaN(value)) return TEXT_SIZE_DEFAULT;
  return Math.min(TEXT_SIZE_MAX, Math.max(TEXT_SIZE_MIN, Math.round(value)));
}

/** "100%", "150%", "200%". */
export function textSizePercent(px: number): string {
  return `${Math.round((px / TEXT_SIZE_DEFAULT) * 100)}%`;
}

/**
 * Write the text size to the root: ONE property, `--pn-font-size`. The `--pn-text-*` tokens are rem-only in tokens.css
 * and `html` uses `font-size: var(--pn-font-size)`, so every size scales from that single value (87.5% to 200%) and
 * nothing else is written. The tab bar caps its own labels in CSS so four tabs still fit at 200%.
 */
export function applyTextSize(px: number, root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--pn-font-size', `${clampTextSize(px)}px`);
}
