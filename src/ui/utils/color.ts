/** Small color math for cover tinting. Pure functions, no DOM. Colors are [r, g, b] with 0..255 channels. */
import { contrastRatio, parseHex } from './wcag';

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  return parseHex(hex);
}

export function rgbToHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}

/** Mix `a` toward `b`: amount 0 gives a, 1 gives b. */
export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = Math.min(1, Math.max(0, amount));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round) as unknown as Rgb;
}

export function ratio(a: Rgb, b: Rgb): number {
  return contrastRatio(rgbToHex(a), rgbToHex(b));
}

export interface TintInput {
  /** Dominant color of the cover. */
  cover: Rgb;
  /** Theme page color the tint replaces. */
  page: Rgb;
  /** Theme colors that must stay readable on the tint (text, muted text, accent text...). */
  foregrounds: readonly Rgb[];
  /** Largest share of the cover color in the tint (0..1). Default 0.32. */
  maxAmount?: number;
  /** Required contrast for every foreground. Default 4.5 (WCAG AA). */
  minContrast?: number;
}

/**
 * Background tint for a sheet or player: the page color with some of the cover color mixed in.
 * The amount is reduced step by step until every foreground still meets `minContrast`, so text stays
 * AA on any cover, including very dark covers in the light themes and very bright ones in the dark themes.
 * Returns the tint and the amount actually used (0 means "no tint").
 */
export function clampTint({ cover, page, foregrounds, maxAmount = 0.32, minContrast = 4.5 }: TintInput): {
  color: Rgb;
  amount: number;
} {
  const steps = 16;
  for (let i = steps; i >= 0; i -= 1) {
    const amount = (maxAmount * i) / steps;
    const color = mix(page, cover, amount);
    if (foregrounds.every((fg) => ratio(fg, color) >= minContrast)) return { color, amount };
  }
  return { color: page, amount: 0 };
}
