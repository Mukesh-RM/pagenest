import { FONT_SIZE_DEFAULT } from './font-size';

/**
 * Apply the app text size (px at the 100 % default of 16) to the document root.
 *
 * Only `--pn-font-size` is written. `html` uses it as its font size, and every design token
 * (`--pn-text-xs` to `--pn-text-xl` in `src/ui/styles/tokens.css`) is in `rem`, so the whole app
 * scales from this one value, up to 200 % (32 px). The app never writes px text tokens: a px
 * override would stop the tokens following the setting and would fight the user's browser
 * font-size preference.
 */
export function applyFontSize(px: number, root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--pn-font-size', `${px}px`);
}

/** The text size as a percentage of the default, for labels ("125%"). */
export function fontScalePercent(px: number): number {
  return Math.round((px / FONT_SIZE_DEFAULT) * 100);
}
