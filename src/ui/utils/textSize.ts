/**
 * App text size (blueprint 5.8, "dynamic text size"): 14 px up to 32 px on a 16 px base, that is 87.5% to 200%.
 * One number drives everything: the root font size (rem sizes follow) and the `--pn-text-*` tokens. Pure helpers plus
 * one DOM writer, so the app's settings store and the design system agree on the limits.
 */
export const TEXT_SIZE_MIN = 14;
export const TEXT_SIZE_MAX = 32;
export const TEXT_SIZE_DEFAULT = 16;
export const TEXT_SIZE_STEP = 1;

/** The design-system text tokens at the default size, in px (`--pn-text-*` in tokens.css). */
export const TEXT_TOKEN_PX = { xs: 12, sm: 14, md: 16, lg: 20, xl: 28 } as const;

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
 * Write the text size to the root: `--pn-font-size` and every `--pn-text-*` as px (scaled by size / 16). The smallest
 * token (tab labels, captions) grows at most 15 percent, as it always did, so tight chrome keeps fitting; the tab bar
 * additionally caps its labels in CSS.
 */
export function applyTextSize(px: number, root: HTMLElement = document.documentElement): void {
  const size = clampTextSize(px);
  const scale = size / TEXT_SIZE_DEFAULT;
  root.style.setProperty('--pn-font-size', `${size}px`);
  for (const [name, base] of Object.entries(TEXT_TOKEN_PX)) {
    const factor = name === 'xs' ? Math.min(scale, 1.15) : scale;
    root.style.setProperty(`--pn-text-${name}`, `${Math.round(base * factor)}px`);
  }
}
