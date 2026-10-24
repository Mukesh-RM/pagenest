import type { HighlightColor, ReaderAppearance } from '@/engines/reader/types';
import { THEME_PALETTE } from '@/ui/theme/palette';
import { blend, contrast, isSafeColor, parseColor, toHex } from './color';
import { DEFAULT_FONT, fontFaceCss, fontForFamily } from './fonts';

/** Limits from blueprint 5.3 and the `ReaderAppearance` contract. */
export const LIMITS = {
  fontSizePx: { min: 12, max: 40, step: 1 },
  lineHeight: { min: 1.2, max: 2, step: 0.05 },
  paragraphSpacingEm: { min: 0, max: 2, step: 0.1 },
} as const;

export const DEFAULT_APPEARANCE: ReaderAppearance = {
  theme: 'light',
  fontFamily: DEFAULT_FONT.family,
  fontSizePx: 18,
  lineHeight: 1.6,
  paragraphSpacingEm: 0.6,
  margins: 'normal',
  align: 'left',
  hyphenate: true,
  pageTurn: 'slide',
};

export const THEME_ORDER = ['light', 'sepia', 'dark', 'black', 'custom'] as const;

const clamp = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

/**
 * Turn anything (a saved setting, a partial update) into a valid appearance. Out-of-range numbers are clamped,
 * unknown words fall back to the default, unsafe colors are dropped. Never throws.
 */
export function normalizeAppearance(input: unknown, base: ReaderAppearance = DEFAULT_APPEARANCE): ReaderAppearance {
  const v = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const custom = v['custom'] as Record<string, unknown> | undefined;
  const customOk =
    custom && isSafeColor(custom['page']) && isSafeColor(custom['text']) && isSafeColor(custom['accent'])
      ? { page: custom['page'] as string, text: custom['text'] as string, accent: custom['accent'] as string }
      : base.custom;
  const theme = pick(v['theme'], THEME_ORDER, base.theme);
  return {
    theme: theme === 'custom' && !customOk ? 'light' : theme,
    ...(customOk ? { custom: customOk } : {}),
    fontFamily: typeof v['fontFamily'] === 'string' && v['fontFamily'] ? fontForFamily(v['fontFamily']).family : base.fontFamily,
    fontSizePx: Math.round(clamp(v['fontSizePx'], LIMITS.fontSizePx.min, LIMITS.fontSizePx.max, base.fontSizePx)),
    lineHeight: Math.round(clamp(v['lineHeight'], LIMITS.lineHeight.min, LIMITS.lineHeight.max, base.lineHeight) * 100) / 100,
    paragraphSpacingEm:
      Math.round(clamp(v['paragraphSpacingEm'], LIMITS.paragraphSpacingEm.min, LIMITS.paragraphSpacingEm.max, base.paragraphSpacingEm) * 100) / 100,
    margins: pick(v['margins'], ['narrow', 'normal', 'wide'] as const, base.margins),
    align: pick(v['align'], ['left', 'justify'] as const, base.align),
    hyphenate: typeof v['hyphenate'] === 'boolean' ? v['hyphenate'] : base.hyphenate,
    pageTurn: pick(v['pageTurn'], ['slide', 'curl', 'scroll', 'none'] as const, base.pageTurn),
  };
}

export interface ThemeColors {
  readonly page: string;
  readonly text: string;
  readonly accent: string;
  readonly muted: string;
  readonly scheme: 'light' | 'dark';
}

/** Page, text and accent for the appearance's theme, from the design tokens (blueprint 5.2). */
export function themeColors(appearance: ReaderAppearance): ThemeColors {
  if (appearance.theme === 'custom' && appearance.custom) {
    const page = parseColor(appearance.custom.page);
    const dark = page ? page.r * 0.299 + page.g * 0.587 + page.b * 0.114 < 128 : false;
    return {
      page: appearance.custom.page,
      text: appearance.custom.text,
      accent: appearance.custom.accent,
      muted: appearance.custom.text,
      scheme: dark ? 'dark' : 'light',
    };
  }
  const name = appearance.theme === 'custom' ? 'light' : appearance.theme;
  const p = THEME_PALETTE[name];
  return { page: p.page, text: p.text, accent: p.link, muted: p.muted, scheme: name === 'dark' || name === 'black' ? 'dark' : 'light' };
}

/** Contrast of text on page for the current theme (a custom theme can be too faint; the Aa sheet warns). */
export function textContrast(appearance: ReaderAppearance): number {
  const c = themeColors(appearance);
  return contrast(c.text, c.page) ?? 1;
}

/** Highlight fill colors and the alpha they are drawn with. Chosen so body text stays AA on all five themes. */
export const HIGHLIGHT_FILL: Readonly<Record<HighlightColor, string>> = {
  yellow: '#f5c518',
  green: '#4cc38a',
  blue: '#5b9dff',
  pink: '#ff6f9f',
};
export const HIGHLIGHT_ALPHA = 0.32;

/** The page color with a highlight drawn on top, for contrast checks. */
export function highlightedPage(pageColor: string, color: HighlightColor): string {
  const page = parseColor(pageColor);
  const fill = parseColor(HIGHLIGHT_FILL[color]);
  if (!page || !fill) return pageColor;
  return toHex(blend(fill, page, HIGHLIGHT_ALPHA));
}

export interface PageLayoutHints {
  /** Space between columns, also the side padding (paginator `gap`, a percentage). */
  readonly gapPercent: number;
  /** Maximum width of one text column in px. */
  readonly maxInlinePx: number;
}

export function marginHints(margins: ReaderAppearance['margins']): PageLayoutHints {
  switch (margins) {
    case 'narrow':
      return { gapPercent: 3, maxInlinePx: 920 };
    case 'wide':
      return { gapPercent: 10, maxInlinePx: 600 };
    default:
      return { gapPercent: 6, maxInlinePx: 720 };
  }
}

/**
 * CSS injected into every section of a reflowable book. Theme colors come from the tokens; `!important` is used
 * on purpose so a publisher's own colors can never break contrast (blueprint 5.2: all text meets WCAG AA).
 */
export function reflowCss(appearance: ReaderAppearance): string {
  const colors = themeColors(appearance);
  const font = fontForFamily(appearance.fontFamily);
  const justify = appearance.align === 'justify';
  const hyph = appearance.hyphenate ? 'auto' : 'manual';
  return `${fontFaceCss(font)}
html{color-scheme:${colors.scheme};background:${colors.page}!important;font-size:${appearance.fontSizePx}px!important;-webkit-text-size-adjust:100%;}
body{background:${colors.page}!important;color:${colors.text}!important;font-family:${font.family}!important;font-size:1rem!important;line-height:${appearance.lineHeight}!important;text-align:${justify ? 'justify' : 'start'};-webkit-hyphens:${hyph};hyphens:${hyph};overflow-wrap:break-word;text-rendering:optimizeLegibility;}
body *:not(img):not(svg):not(a):not(a *){color:inherit!important;background-color:transparent!important;font-family:inherit!important;}
a,a *{color:${colors.accent}!important;}
p,li,dd,blockquote{line-height:${appearance.lineHeight}!important;text-align:${justify ? 'justify' : 'start'};}
p{margin-block:0 ${appearance.paragraphSpacingEm}em;}
h1,h2,h3,h4,h5,h6{line-height:1.25!important;text-align:start;-webkit-hyphens:manual;hyphens:manual;break-after:avoid;}
img,svg,video{max-inline-size:100%;block-size:auto;break-inside:avoid;}
table{display:block;max-inline-size:100%;overflow-x:auto;}
pre{white-space:pre-wrap;}
::selection{background:color-mix(in srgb,${colors.accent} 35%,transparent);color:inherit;}
${(Object.keys(HIGHLIGHT_FILL) as HighlightColor[]).map((c) => `.pn-hl-${c}{background:${HIGHLIGHT_FILL[c]}52;}`).join('')}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important;}}
`;
}

/** How the PDF canvas is tinted so the page matches the reader theme (blueprint 5.6, "night inversion"). */
export interface PdfTint {
  readonly background: string;
  /** CSS `filter` for the page canvas. */
  readonly filter: string;
  /** CSS `mix-blend-mode` for the page canvas. */
  readonly blend: string;
}

export function pdfTint(appearance: ReaderAppearance): PdfTint {
  const colors = themeColors(appearance);
  if (appearance.theme === 'dark' || appearance.theme === 'black') {
    // Invert, then rotate the hue back so photos keep their colors; the page ends near the theme's page color.
    return { background: colors.page, filter: 'invert(1) hue-rotate(180deg) brightness(0.92)', blend: 'normal' };
  }
  if (appearance.theme === 'sepia') return { background: colors.page, filter: 'none', blend: 'multiply' };
  if (appearance.theme === 'custom') {
    return colors.scheme === 'dark'
      ? { background: colors.page, filter: 'invert(1) hue-rotate(180deg) brightness(0.92)', blend: 'normal' }
      : { background: colors.page, filter: 'none', blend: 'multiply' };
  }
  return { background: '#ffffff', filter: 'none', blend: 'normal' };
}
