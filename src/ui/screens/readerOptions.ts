import type { LineSpacing, MarginSize } from '../types';

/** Reader limits and the CSS values behind the line-spacing and margin choices (a plain module, so screen files export only components). */
export const READER_MIN_FONT = 14;
export const READER_MAX_FONT = 32;

export const LINE_HEIGHT: Record<LineSpacing, number> = { compact: 1.4, comfortable: 1.6, airy: 1.85 };
export const MARGIN_PX: Record<MarginSize, number> = { narrow: 16, medium: 24, wide: 40 };
