import { cx } from '../utils/cx';

interface GlyphProps {
  size?: number;
  className?: string;
}

/** Filled play or pause glyph: the same drawing in the full player and the mini-player, so the two always match. */
export function PlayPauseGlyph({ playing, size = 32, className }: GlyphProps & { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}>
      {playing ? (
        <>
          <rect x="14" y="3" width="5" height="18" rx="1" />
          <rect x="5" y="3" width="5" height="18" rx="1" />
        </>
      ) : (
        <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
      )}
    </svg>
  );
}

/**
 * "Skip back 15" and "Skip forward 30": a circular arrow with the number INSIDE it, so nobody has to guess whether
 * the icon means "previous track" or "replay". The number is real text, large enough to read at arm's length.
 */
export function SkipGlyph({ direction, seconds, size = 40, className }: GlyphProps & { direction: 'back' | 'forward'; seconds: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={cx('pn-skip-glyph', className)}>
      {direction === 'back' ? (
        <>
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </>
      ) : (
        <>
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </>
      )}
      <text x="12" y="15.4" textAnchor="middle" className="pn-skip-glyph__n" fill="currentColor" stroke="none">
        {seconds}
      </text>
    </svg>
  );
}
