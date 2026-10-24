/**
 * Custom theme (blueprint 5.2: "You pick"). The person chooses three colors (page, text, accent); everything else
 * is derived, and every derived or chosen color is nudged until text stays readable, so a Custom theme can never
 * fail WCAG AA. Pure functions, no DOM: unit-tested, and used by the ThemeProvider, the picker and the app's store.
 *
 * Guarantees for any three inputs, valid or not (checked in custom.test.ts across thousands of random inputs):
 * - an invalid color is replaced by the default one, never thrown;
 * - text on page, surface and raised surface: 4.5:1 or better (7:1 when the page color allows it);
 * - muted text, links, accent text, accent-ink on accent-soft and danger text: 4.5:1 or better;
 * - the label on an accent button (on-accent): 4.5:1 or better;
 * - strong borders and the focus ring: 3:1 or better against the page.
 */
import type { CSSProperties } from 'react';
import { COLOR_TOKENS, type ColorToken } from './palette';
import { contrastRatio, parseHex } from '../utils/wcag';

export const CUSTOM_THEME_ID = 'custom';

export interface CustomThemeInput {
  /** Page background, `#rrggbb`. */
  page: string;
  /** Main text color, `#rrggbb`. */
  text: string;
  /** Accent (buttons, links, selection), `#rrggbb`. */
  accent: string;
}

/** A calm dusk palette: the Custom theme before the person changes anything. */
export const DEFAULT_CUSTOM_THEME: Readonly<CustomThemeInput> = {
  page: '#1e2230',
  text: '#ebe7f2',
  accent: '#b9a7f5',
};

export interface ResolvedCustomTheme {
  /** The three chosen colors after validation (what the person sees in the pickers). */
  input: CustomThemeInput;
  /** Every color token as `#rrggbb`. */
  palette: Readonly<Record<ColorToken, string>>;
  scheme: 'light' | 'dark';
  /** Which choices had to be changed to stay readable. The picker says so in plain words. */
  adjusted: { text: boolean; accent: boolean };
}

/** `#abc`, `abc`, `#AABBCC` and `aabbcc` all become `#aabbcc`; anything else gives `fallback`. */
export function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return fallback;
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!;
  return `#${h.toLowerCase()}`;
}

/** Read a saved value: a full valid object, or `undefined`. Safe for IndexedDB data of any shape. */
export function parseCustomTheme(value: unknown): CustomThemeInput | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const page = normalizeHex(v.page, '');
  const text = normalizeHex(v.text, '');
  const accent = normalizeHex(v.accent, '');
  return page && text && accent ? { page, text, accent } : undefined;
}

type Rgb = [number, number, number];
const WHITE = '#ffffff';
const BLACK = '#000000';

const toHex = ([r, g, b]: Rgb): string =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

/** Mix `a` toward `b` (amount 0 gives a, 1 gives b). */
function mixHex(a: string, b: string, amount: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * amount) as Rgb);
}

/** Move `color` toward `target` in 4% steps until `ok` holds; `target` itself is the last resort. */
function nudge(color: string, target: string, ok: (c: string) => boolean): { color: string; changed: boolean } {
  if (ok(color)) return { color, changed: false };
  for (let i = 1; i <= 25; i += 1) {
    const next = mixHex(color, target, i * 0.04);
    if (ok(next)) return { color: next, changed: true };
  }
  return { color: target, changed: true };
}

const cr = contrastRatio;
const bestOn = (bg: string): string => (cr(WHITE, bg) >= cr(BLACK, bg) ? WHITE : BLACK);

/**
 * Derive a full, readable palette from three chosen colors. See the file comment for the guarantees.
 */
export function resolveCustomTheme(input: Partial<CustomThemeInput> | undefined = DEFAULT_CUSTOM_THEME): ResolvedCustomTheme {
  const page = normalizeHex(input?.page, DEFAULT_CUSTOM_THEME.page);
  const wantText = normalizeHex(input?.text, DEFAULT_CUSTOM_THEME.text);
  const wantAccent = normalizeHex(input?.accent, DEFAULT_CUSTOM_THEME.accent);

  // Dark scheme when white text reads better on the page than black text does.
  const scheme: 'light' | 'dark' = cr(WHITE, page) >= cr(BLACK, page) ? 'dark' : 'light';
  const extreme = scheme === 'dark' ? WHITE : BLACK;

  // Surfaces step toward white (cards sit above the page in every scheme).
  const surfaceAt = (amount: number) => mixHex(page, WHITE, amount);
  let surfaceAmount = scheme === 'dark' ? 0.05 : 0.6;
  let raisedAmount = scheme === 'dark' ? 0.09 : 0.85;

  // Text: 7:1 on the page when possible (extreme text always gives 4.5:1 or better), and 4.5:1 on both surfaces.
  const textOk = (c: string): boolean =>
    cr(c, page) >= Math.min(7, cr(extreme, page)) && cr(c, surfaceAt(surfaceAmount)) >= 4.5 && cr(c, surfaceAt(raisedAmount)) >= 4.5;
  const text = nudge(wantText, extreme, textOk);
  // If lifting the surfaces made the text fall short (mid-tone pages), keep the surfaces closer to the page.
  while ((cr(text.color, surfaceAt(raisedAmount)) < 4.5 || cr(text.color, surfaceAt(surfaceAmount)) < 4.5) && raisedAmount > 0) {
    raisedAmount = Math.max(0, raisedAmount - 0.05);
    surfaceAmount = Math.min(surfaceAmount, raisedAmount);
  }
  const surface = surfaceAt(surfaceAmount);
  const raised = surfaceAt(raisedAmount);

  const muted = nudge(mixHex(text.color, page, 0.32), text.color, (c) => cr(c, page) >= 4.5 && cr(c, raised) >= 4.5 && cr(c, surface) >= 4.5).color;

  // Accent: readable as text and links on the page and raised surface; its button label gets the better of white and black.
  const accentOk = (c: string): boolean => cr(c, page) >= 4.5 && cr(c, raised) >= 4.5 && cr(c, surface) >= 4.5;
  const accent = nudge(wantAccent, text.color, accentOk);
  const onAccent = bestOn(accent.color);
  // accent-soft is the tint behind chips; shrink it until accent-ink (accent nudged toward the extreme) reads on it.
  let softAmount = scheme === 'dark' ? 0.2 : 0.14;
  let accentSoft = mixHex(page, accent.color, softAmount);
  let accentInk = nudge(accent.color, extreme, (c) => cr(c, accentSoft) >= 4.5 && cr(c, page) >= 4.5).color;
  while (softAmount > 0 && (cr(accentInk, accentSoft) < 4.5 || cr(accentInk, page) < 4.5)) {
    softAmount = Math.max(0, softAmount - 0.02);
    accentSoft = mixHex(page, accent.color, softAmount);
    accentInk = nudge(accent.color, extreme, (c) => cr(c, accentSoft) >= 4.5 && cr(c, page) >= 4.5).color;
  }

  const borderStrong = nudge(mixHex(page, text.color, 0.35), text.color, (c) => cr(c, page) >= 3 && cr(c, raised) >= 3).color;
  const danger = nudge(scheme === 'dark' ? '#ff8f86' : '#b3261e', text.color, (c) => cr(c, page) >= 4.5 && cr(c, raised) >= 4.5 && cr(c, accentSoft) >= 4.5).color;

  const inverseSurface = text.color;
  const inverseAccent = nudge(accent.color, page, (c) => cr(c, inverseSurface) >= 4.5).color;

  const palette: Record<ColorToken, string> = {
    'page': page,
    'surface': surface,
    'surface-raised': raised,
    'text': text.color,
    'muted': muted,
    'accent': accent.color,
    'on-accent': onAccent,
    'accent-soft': accentSoft,
    'accent-ink': accentInk,
    'link': accent.color,
    'border-strong': borderStrong,
    'line': mixHex(page, text.color, 0.14),
    'focus-ring': accent.color,
    'danger': danger,
    'on-danger': bestOn(danger),
    'inverse-surface': inverseSurface,
    'inverse-text': page,
    'inverse-accent': inverseAccent,
    'skeleton': mixHex(page, text.color, 0.06),
    'skeleton-highlight': mixHex(page, text.color, 0.11),
    'scrim': scheme === 'dark' ? BLACK : mixHex(text.color, BLACK, 0.4),
  };
  return {
    input: { page, text: wantText, accent: wantAccent },
    palette,
    scheme,
    adjusted: { text: text.changed, accent: accent.changed },
  };
}

const triplet = (hex: string): string => parseHex(hex).join(' ');

/**
 * Inline style that carries a resolved Custom theme: every `--pn-*` color as an RGB triplet, plus the
 * scheme-dependent scrim and shadow. Put it on an element with `data-theme="custom"` (the provider and
 * `ThemeScope` do), and the whole subtree, including portals, follows.
 */
export function customThemeStyle(resolved: ResolvedCustomTheme): CSSProperties {
  const style: Record<string, string> = { colorScheme: resolved.scheme };
  for (const token of COLOR_TOKENS) style[`--pn-${token}`] = triplet(resolved.palette[token]);
  style['--pn-scrim-opacity'] = resolved.scheme === 'dark' ? '0.6' : '0.45';
  style['--pn-shadow-raised'] = resolved.scheme === 'dark' ? 'none' : `0 -2px 16px rgb(${triplet(resolved.palette.text)} / 0.12)`;
  return style as CSSProperties;
}

/** Text and surface pairs that the Custom theme must keep AA, for the picker's live check and for tests. */
export function customContrastPairs(r: ResolvedCustomTheme): ReadonlyArray<{ name: string; fg: string; bg: string; min: number }> {
  const p = r.palette;
  return [
    { name: 'text on page', fg: p.text, bg: p.page, min: 4.5 },
    { name: 'text on surface', fg: p.text, bg: p.surface, min: 4.5 },
    { name: 'text on raised surface', fg: p.text, bg: p['surface-raised'], min: 4.5 },
    { name: 'muted text on page', fg: p.muted, bg: p.page, min: 4.5 },
    { name: 'muted text on raised surface', fg: p.muted, bg: p['surface-raised'], min: 4.5 },
    { name: 'link on page', fg: p.link, bg: p.page, min: 4.5 },
    { name: 'link on raised surface', fg: p.link, bg: p['surface-raised'], min: 4.5 },
    { name: 'button label on accent', fg: p['on-accent'], bg: p.accent, min: 4.5 },
    { name: 'accent-ink on accent-soft', fg: p['accent-ink'], bg: p['accent-soft'], min: 4.5 },
    { name: 'danger text on page', fg: p.danger, bg: p.page, min: 4.5 },
    { name: 'danger button label', fg: p['on-danger'], bg: p.danger, min: 4.5 },
    { name: 'snackbar text', fg: p['inverse-text'], bg: p['inverse-surface'], min: 4.5 },
    { name: 'snackbar action', fg: p['inverse-accent'], bg: p['inverse-surface'], min: 4.5 },
    { name: 'strong border on page', fg: p['border-strong'], bg: p.page, min: 3 },
    { name: 'focus ring on page', fg: p['focus-ring'], bg: p.page, min: 3 },
  ];
}
