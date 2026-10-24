/** Small WCAG color helpers for reader themes. Accepts `#rgb`, `#rrggbb`, `rgb()` and `rgba()` strings. */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_FN = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/i;

/** True for the color notations {@link parseColor} understands (also keeps CSS injection out of generated styles). */
export function isSafeColor(value: unknown): value is string {
  return typeof value === 'string' && parseColor(value) !== undefined;
}

export function parseColor(value: string): Rgb | undefined {
  const text = value.trim();
  const hex = HEX.exec(text);
  if (hex) {
    const h = hex[1] as string;
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    const n = Number.parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const fn = RGB_FN.exec(text);
  if (fn) {
    const [r, g, b] = [fn[1], fn[2], fn[3]].map(Number) as [number, number, number];
    if (r > 255 || g > 255 || b > 255) return undefined;
    return { r, g, b };
  }
  return undefined;
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2 contrast ratio (1 to 21). Returns `undefined` when a color cannot be read. */
export function contrast(a: string, b: string): number | undefined {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return undefined;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Color of `top` drawn over `bottom` at `alpha` (0 to 1). */
export function blend(top: Rgb, bottom: Rgb, alpha: number): Rgb {
  const mix = (t: number, b: number): number => t * alpha + b * (1 - alpha);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b) };
}
