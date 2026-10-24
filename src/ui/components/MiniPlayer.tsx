import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Icon } from '../icons';
import { cx } from '../utils/cx';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';

export interface MiniPlayerProps {
  title: string;
  /** Author, narrator or chapter. */
  subtitle?: string;
  /** Cover image URL. Without one, a colored book tile is shown. */
  coverUrl?: string;
  /** Replace the cover tile entirely. */
  cover?: ReactNode;
  /** Visual state only: shows the pause icon when true. The app owns the real audio state. */
  playing: boolean;
  /** 0 to 1 position in the current item. */
  progress?: number;
  onTogglePlay: () => void;
  onSkipBack: () => void;
  /** Tap on the cover or title, Enter, or a swipe up. */
  onExpand: () => void;
  skipBackSeconds?: number;
  className?: string;
}

const SWIPE_UP_PX = 32;

/**
 * Floating mini-player: cover, title, play and back-15, swipe up to expand (blueprint 5.6).
 * Visual shell only: no audio element and no timers live here; the audio controller drives it.
 */
export function MiniPlayer({
  title,
  subtitle,
  coverUrl,
  cover,
  playing,
  progress = 0,
  onTogglePlay,
  onSkipBack,
  onExpand,
  skipBackSeconds = 15,
  className,
}: MiniPlayerProps) {
  const start = useRef<{ y: number } | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    start.current = { y: event.clientY };
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const s = start.current;
    start.current = null;
    if (s && s.y - event.clientY > SWIPE_UP_PX) onExpand();
  };

  return (
    <section
      aria-label="Mini player"
      className={cx('pn-miniplayer', className)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
      }}
    >
      <button type="button" className="pn-miniplayer__expand" onClick={onExpand} aria-label={`Open player: ${title}`}>
        <span className="pn-miniplayer__cover" aria-hidden="true">
          {cover ?? (coverUrl ? <img src={coverUrl} alt="" /> : <Icon name="headphones" />)}
        </span>
        <span className="pn-miniplayer__text">
          <span className="pn-miniplayer__title">{title}</span>
          {subtitle ? <span className="pn-miniplayer__subtitle">{subtitle}</span> : null}
        </span>
      </button>
      <Button
        iconOnly
        variant="ghost"
        icon="skipBack"
        aria-label={`Back ${skipBackSeconds} seconds`}
        onClick={onSkipBack}
      />
      <Button
        iconOnly
        variant="primary"
        icon={playing ? 'pause' : 'play'}
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={onTogglePlay}
      />
      <ProgressBar value={progress} label="Playback position" className="pn-miniplayer__progress" />
    </section>
  );
}
