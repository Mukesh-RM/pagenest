import { useState, type CSSProperties } from 'react';
import { cx } from '../utils/cx';

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

export interface BookCoverProps {
  title: string;
  author?: string;
  /** Cover image. Missing, or failing to load, gives a generated title card. */
  src?: string;
  /** Eager loading for the first screen of covers (LCP); the default is lazy. */
  eager?: boolean;
  className?: string;
}

/**
 * Book cover, always 2:3 so the grid never shifts. With an image: the image. Without one (or if it fails): a
 * designed title card with the title in Literata and the author in Inter. Decorative for screen readers: the
 * title and author are announced by the card or sheet that contains it.
 */
export function BookCover({ title, author, src, eager, className }: BookCoverProps) {
  const [failed, setFailed] = useState<string | undefined>();
  const showImage = Boolean(src) && failed !== src;
  if (showImage) {
    return (
      <span className={cx('pn-cover', className)}>
        <img
          className="pn-cover__img"
          src={src}
          alt=""
          width={200}
          height={300}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onError={() => setFailed(src)}
        />
      </span>
    );
  }
  const colors = TITLE_CARD_COLORS[titleCardIndex(title)]!;
  const style = { '--pn-cover-bg': colors.background, '--pn-cover-fg': colors.foreground } as CSSProperties;
  return (
    <span className={cx('pn-cover', 'pn-cover--generated', className)} style={style} aria-hidden="true">
      <span className="pn-cover__rule" />
      <span className="pn-cover__title">{title}</span>
      {author ? <span className="pn-cover__author">{author}</span> : null}
    </span>
  );
}
