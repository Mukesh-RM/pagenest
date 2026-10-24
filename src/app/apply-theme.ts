import { FONT_SIZE_DEFAULT } from './font-size';

/** Design-system text tokens (px at the default size). `--pn-text-*` in `src/ui/styles/tokens.css`. */
const TEXT_TOKENS = { xs: 12, sm: 14, md: 16, lg: 20, xl: 28 } as const;

/**
 * Apply the app text size (px) to the document root:
 * - `--pn-font-size`, which `html` uses so rem-based sizes scale;
 * - the design system's `--pn-text-*` tokens, scaled by size / 16, so components from
 *   `src/ui` follow the setting too. The smallest size (tab labels) grows at most 15 percent
 *   so four tabs still fit on a 360 px screen.
 */
export function applyFontSize(px: number, root: HTMLElement = document.documentElement): void {
  const scale = px / FONT_SIZE_DEFAULT;
  root.style.setProperty('--pn-font-size', `${px}px`);
  for (const [name, base] of Object.entries(TEXT_TOKENS)) {
    const factor = name === 'xs' ? Math.min(scale, 1.15) : scale;
    root.style.setProperty(`--pn-text-${name}`, `${Math.round(base * factor)}px`);
  }
}
