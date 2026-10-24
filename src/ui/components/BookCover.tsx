import { useState, type CSSProperties } from 'react';
import { cx } from '../utils/cx';
import { FavoriteBadge } from './FavoriteBadge';

/** Fixed, hand-checked pairs for generated title cards. Text on background is 4.5:1 or better in every pair. */
export const TITLE_CARD_COLORS: ReadonlyArray<{ background: string; foreground: string }> = [
  { background: '#2f6f6b', foreground: '#f4f1e8' },
  { background: '#7a3b2e', foreground: '#fbefe6' },
  { background: '#2e3f6b', foreground: '#eef1fb' },
  { background: '#5b4a8a', foreground: '#f5f0ff' },
  { background: '#8a5a1f', foreground: '#fff6e6' },
  { background: '#3e5c3a', foreground: '#eff6ec' },
  { background: '#6b2e4a', foreground: '#fceff5' },
  { background: '#23363f', foreground: '#e8f0f3' },
];

/** Stable pick from the title, so a book keeps its color on every device and launch. */
export function titleCardIndex(title: string): number {
  let hash = 5381;
  for (let i = 0; i < title.length; i += 1) hash = ((hash << 5) + hash + title.charCodeAt(i)) | 0;
  return Math.abs(hash) % TITLE_CARD_COLORS.length;
}

/**
 * Tiles for monogram covers: a white or near-black letter on a flat color. Every pair is 7:1 or better, so the letter
 * passes AA in every theme and also the 7:1 of high contrast (a tile does not change with the theme). Checked in tests.
 */
export const MONOGRAM_COLORS: ReadonlyArray<{ background: string; foreground: string }> = [
  { background: '#246058', foreground: '#ffffff' },
  { background: '#6f382a', foreground: '#ffffff' },
  { background: '#2a3f6f', foreground: '#ffffff' },
  { background: '#482a6f', foreground: '#ffffff' },
  { background: '#6f512a', foreground: '#ffffff' },
  { background: '#256225', foreground: '#ffffff' },
  { background: '#6f2a4d', foreground: '#ffffff' },
  { background: '#2a586f', foreground: '#ffffff' },
  { background: '#cbebe7', foreground: '#111111' },
  { background: '#ebe1cb', foreground: '#111111' },
  { background: '#cbd5eb', foreground: '#111111' },
  { background: '#ebcbdb', foreground: '#111111' },
];

/** First letter (or digit) of the title, upper-cased. "" for a title with none. */
export function monogramLetter(title: string): string {
  for (const ch of Array.from(title.trim())) {
    if (/[\p{L}\p{N}]/u.test(ch)) return ch.toLocaleUpperCase();
  }
  return '';
}

/** Stable tile pick from the title, same hash as the title card, so a book keeps its color on every device. */
export function monogramIndex(title: string): number {
  let hash = 5381;
  for (let i = 0; i < title.length; i += 1) hash = ((hash << 5) + hash + title.charCodeAt(i)) | 0;
  return Math.abs(hash) % MONOGRAM_COLORS.length;
}

export interface BookCoverProps {
  title: string;
  author?: string;
  /** Cover image. Missing, or failing to load, gives a generated title card. */
  src?: string;
  /** Eager loading for the first screen of covers (LCP); the default is lazy. */
  eager?: boolean;
  /**
   * Without an image (or when it fails), draw a colored tile with the first letter of the title and nothing else (no
   * author, no title text) instead of the generated title card. Cards use it: a long title never has to fit a small tile.
   */
  monogram?: boolean;
  /** `contain` (default) shows the whole 2:3 image, letterboxed on a neutral tile when its shape differs; `cover` fills and crops. */
  fit?: 'contain' | 'cover';
  /** Draws the small "Favorite" heart in the bottom-left corner. Off by default; cards draw their own badges. */
  favorite?: boolean;
  className?: string;
}

/**
 * Book cover, always 2:3 so the grid never shifts. With an image: the image. Without one (or if it fails): a
 * designed title card with the title in Literata and the author in Inter. Decorative for screen readers: the
 * title and author are announced by the card or sheet that contains it.
 */
export function BookCover({ title, author, src, eager, favorite, monogram, fit = 'contain', className }: BookCoverProps) {
  const [failed, setFailed] = useState<string | undefined>();
  const showImage = Boolean(src) && failed !== src;
  if (showImage) {
    return (
      <span className={cx('pn-cover', className)}>
        <img
          className={cx('pn-cover__img', fit === 'cover' && 'pn-cover__img--fill')}
          src={src}
          alt=""
          width={200}
          height={300}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onError={() => setFailed(src)}
        />
        {favorite ? <FavoriteBadge /> : null}
      </span>
    );
  }
  if (monogram && monogramLetter(title)) {
    const tile = MONOGRAM_COLORS[monogramIndex(title)]!;
    const tileStyle = { '--pn-cover-bg': tile.background, '--pn-cover-fg': tile.foreground } as CSSProperties;
    return (
      <span className={cx('pn-cover', 'pn-cover--monogram', className)} style={tileStyle} aria-hidden={favorite ? undefined : 'true'}>
        <span className="pn-cover__letter" aria-hidden="true">
          {monogramLetter(title)}
        </span>
        {favorite ? <FavoriteBadge /> : null}
      </span>
    );
  }
  const colors = TITLE_CARD_COLORS[titleCardIndex(title)]!;
  const style = { '--pn-cover-bg': colors.background, '--pn-cover-fg': colors.foreground } as CSSProperties;
  return (
    <span className={cx('pn-cover', 'pn-cover--generated', className)} style={style} aria-hidden={favorite ? undefined : 'true'}>
      <span className="pn-cover__inner">
        <span className="pn-cover__rule" />
        <span className="pn-cover__title">{title}</span>
        {author ? <span className="pn-cover__author">{author}</span> : null}
      </span>
      {favorite ? <FavoriteBadge /> : null}
    </span>
  );
}
