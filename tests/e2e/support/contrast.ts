/** Blueprint section 5.2 theme tokens (hex, exactly as written in docs/BLUEPRINT.md). */
export const THEMES = {
  light: { page: '#FAFAF7', text: '#1C1B19', accent: '#3E5BDB' },
  sepia: { page: '#F4ECD8', text: '#3B2F23', accent: '#A0522D' },
  dark: { page: '#17181C', text: '#E4E2DC', accent: '#8FA6FF' },
  black: { page: '#000000', text: '#CFCDC7', accent: '#8FA6FF' },
} as const;

export type ThemeName = keyof typeof THEMES;
export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

export type Rgb = [number, number, number];

/** Parses #rgb, #rrggbb, rgb(r, g, b) and rgba(r, g, b, a) (alpha ignored). */
export function parseColor(input: string): Rgb {
  const s = input.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const fn = /^rgba?\(\s*(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)/.exec(s);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  throw new Error(`Unsupported colour: ${input}`);
}

export function relativeLuminance(input: string): number {
  const [r, g, b] = parseColor(input).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function toHex(input: string): string {
  return '#' + parseColor(input).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}
