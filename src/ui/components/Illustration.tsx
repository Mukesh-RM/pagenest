import type { ReactNode } from 'react';
import { cx } from '../utils/cx';

export type IllustrationName = 'books' | 'shelf' | 'chart' | 'headphones' | 'offline' | 'search' | 'page' | 'done';

/*
 * Designed spot illustrations for empty states, one inline SVG each (no files, no network). Colors come from the
 * theme tokens through the `pn-ill__*` classes, so every illustration is correct in Light, Sepia, Dark and Black
 * and follows the accent. 160 x 120 canvas, decorative (hidden from screen readers; the title says it all).
 */
const ART: Record<IllustrationName, ReactNode> = {
  books: (
    <>
      <circle className="pn-ill__soft" cx="80" cy="64" r="48" />
      <rect className="pn-ill__accent" x="48" y="40" width="18" height="60" rx="3" />
      <rect className="pn-ill__ink" x="68" y="30" width="20" height="70" rx="3" />
      <rect className="pn-ill__paper pn-ill__stroke" x="90" y="46" width="18" height="54" rx="3" />
      <path className="pn-ill__line" d="M53 52h8M53 58h8M73 42h10M73 48h10M95 58h8" />
      <path className="pn-ill__stroke" d="M36 100h88" />
      <path className="pn-ill__accent" d="M116 34c8 2 12 8 12 16-8-2-12-8-12-16Z" />
      <path className="pn-ill__stroke" d="M116 56c0-8 0-14 0-22" />
    </>
  ),
  shelf: (
    <>
      <circle className="pn-ill__soft" cx="80" cy="60" r="48" />
      <rect className="pn-ill__ink" x="40" y="44" width="14" height="46" rx="2" />
      <rect className="pn-ill__accent" x="56" y="36" width="16" height="54" rx="2" />
      <rect className="pn-ill__paper pn-ill__stroke" x="74" y="48" width="14" height="42" rx="2" />
      <rect className="pn-ill__ink" x="90" y="40" width="18" height="50" rx="2" transform="rotate(8 99 65)" />
      <path className="pn-ill__stroke" d="M30 94h100" />
      <path className="pn-ill__accent" d="M60 36v10l4-3 4 3V36" />
    </>
  ),
  chart: (
    <>
      <circle className="pn-ill__soft" cx="80" cy="60" r="48" />
      <rect className="pn-ill__ink" x="46" y="72" width="14" height="22" rx="3" />
      <rect className="pn-ill__accent" x="66" y="56" width="14" height="38" rx="3" />
      <rect className="pn-ill__paper pn-ill__stroke" x="86" y="64" width="14" height="30" rx="3" />
      <rect className="pn-ill__ink" x="106" y="40" width="14" height="54" rx="3" />
      <path className="pn-ill__stroke" d="M36 96h96" />
    </>
  ),
  headphones: (
    <>
      <circle className="pn-ill__soft" cx="80" cy="60" r="48" />
      <path className="pn-ill__stroke pn-ill__thick" d="M48 74V68a32 32 0 0 1 64 0v6" />
      <rect className="pn-ill__accent" x="42" y="70" width="14" height="26" rx="6" />
      <rect className="pn-ill__accent" x="104" y="70" width="14" height="26" rx="6" />
      <path className="pn-ill__line" d="M72 64v12M80 56v28M88 62v16" />
    </>
  ),
  offline: (
    <>
      <circle className="pn-ill__soft" cx="80" cy="60" r="48" />
      <path className="pn-ill__paper pn-ill__stroke" d="M56 84a16 16 0 0 1-2-31 22 22 0 0 1 42-4 18 18 0 0 1 8 35Z" />
      <path className="pn-ill__accent-stroke" d="M50 34 112 94" />
    </>
  ),
  search: (
    <>
      <circle className="pn-ill__soft" cx="80" cy="60" r="48" />
      <rect className="pn-ill__paper pn-ill__stroke" x="46" y="38" width="40" height="54" rx="4" />
      <path className="pn-ill__line" d="M54 52h24M54 60h24M54 68h14" />
      <circle className="pn-ill__paper pn-ill__accent-stroke" cx="94" cy="62" r="16" />
      <path className="pn-ill__accent-stroke" d="m106 74 14 14" />
    </>
  ),
  page: (
    <>
      <circle className="pn-ill__soft" cx="80" cy="60" r="48" />
      <path className="pn-ill__paper pn-ill__stroke" d="M56 30h34l16 16v44a4 4 0 0 1-4 4H56a4 4 0 0 1-4-4V34a4 4 0 0 1 4-4Z" />
      <path className="pn-ill__stroke" d="M90 30v16h16" />
      <path className="pn-ill__accent-stroke" d="m66 70 8 8m0-8-8 8M84 72h14" />
    </>
  ),
  done: (
    <>
      <circle className="pn-ill__soft" cx="80" cy="60" r="48" />
      <circle className="pn-ill__accent" cx="80" cy="60" r="26" />
      <path className="pn-ill__check" d="m68 61 9 9 16-18" />
      <path className="pn-ill__line" d="M80 24v8M80 88v8M44 60h8M108 60h8M54 34l6 6M100 80l6 6M106 34l-6 6M60 80l-6 6" />
    </>
  ),
};

export interface IllustrationProps {
  name: IllustrationName;
  className?: string;
}

/** Themed spot illustration for empty states. Decorative. */
export function Illustration({ name, className }: IllustrationProps) {
  return (
    <svg
      className={cx('pn-ill', className)}
      viewBox="0 0 160 120"
      width="160"
      height="120"
      aria-hidden="true"
      focusable="false"
      data-illustration={name}
    >
      {ART[name]}
    </svg>
  );
}
