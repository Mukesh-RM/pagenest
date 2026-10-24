import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { clampTint, hexToRgb, rgbToHex, type Rgb } from './utils/color';
import { extractCoverColor } from './utils/coverColor';
import { THEME_PALETTE } from './theme/palette';
import { useThemeName } from './theme/ThemeProvider';
import type { ThemeName } from './theme/themes';

export interface CoverTint {
  /** Style to put on the tinted element: sets `--pn-cover-tint` and `--pn-tint-opacity`. */
  style: CSSProperties;
  /** True once a tint was computed and applied (false while loading, or when the cover has no usable color). */
  tinted: boolean;
  /** The tint as a hex color, when tinted. */
  color?: string;
}

/** Pure form of the tint rule, for tests and server-side use: a theme, and a cover color. */
export function tintForTheme(cover: Rgb, theme: ThemeName): { color: string; amount: number } {
  const p = THEME_PALETTE[theme];
  const dark = theme === 'dark' || theme === 'black';
  const { color, amount } = clampTint({
    cover,
    page: hexToRgb(p['surface-raised']),
    // Everything that is drawn as text on the tinted surface must stay AA.
    foregrounds: [hexToRgb(p.text), hexToRgb(p.muted), hexToRgb(p.link), hexToRgb(p['accent-ink']), hexToRgb(p.danger)],
    maxAmount: dark ? 0.4 : 0.2,
  });
  return { color: rgbToHex(color), amount };
}

const NONE: CoverTint = { style: { '--pn-tint-opacity': 0 } as CSSProperties, tinted: false };

/**
 * Cover-tinted background for the book detail sheet and the full player. Extracts the cover's dominant color
 * once (memoized, decoded off the main thread on a 24 x 24 downscale), mixes it into the theme's surface and
 * clamps the amount so text, muted text and links stay at WCAG AA on that tint. The color fades in through an
 * opacity layer (`.pn-tinted`), so nothing but opacity animates.
 */
export function useCoverTint(coverUrl: string | undefined, theme?: ThemeName): CoverTint {
  const scoped = useThemeName();
  const name = theme ?? scoped;
  const [cover, setCover] = useState<{ src: string; rgb: Rgb } | undefined>();

  useEffect(() => {
    let active = true;
    if (!coverUrl) return undefined;
    void extractCoverColor(coverUrl).then((rgb) => {
      if (active && rgb) setCover({ src: coverUrl, rgb });
    });
    return () => {
      active = false;
    };
  }, [coverUrl]);

  return useMemo(() => {
    if (!coverUrl || !cover || cover.src !== coverUrl) return NONE;
    const { color, amount } = tintForTheme(cover.rgb, name);
    if (amount === 0) return NONE;
    return { style: { '--pn-cover-tint': color, '--pn-tint-opacity': 1 } as CSSProperties, tinted: true, color };
  }, [coverUrl, cover, name]);
}
