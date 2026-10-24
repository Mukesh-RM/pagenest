import { useEffect, useRef } from 'react';
import { PlayPauseGlyph, SkipGlyph } from '../components/PlayGlyphs';
import { BookCover } from '../components/BookCover';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Range } from '../components/Range';
import { useCoverTint } from '../hooks';
import type { BookSummary } from '../types';
import { playFlip, takeFlipOrigin, type RectLike } from '../utils/flip';
import { formatClock, formatSpeed, formatDuration, timeLeftLabel } from '../utils/time';
import '../styles/screens.css';
import '../styles/surfaces.css';

/**
 * One object that carries everything the player shows and does. An audio controller (a hook or a store selector in
 * the app) can hand this over as a single prop instead of eleven separate ones.
 */
export interface AudioPlayerController {
  playing: boolean;
  /** Seconds. */
  position: number;
  /** Seconds. */
  duration: number;
  /** Playback speed, for example 1.25. */
  speed: number;
  /** "Off", "15 min", "End of chapter". */
  sleepLabel: string;
  toggle: () => void;
  seek: (seconds: number) => void;
  /** Skip by a signed number of seconds (negative goes back). */
  skip: (deltaSeconds: number) => void;
  /** Cycle to the next speed. */
  cycleSpeed: () => void;
  openSleep: () => void;
  openChapters: () => void;
}

export interface AudioPlayerScreenProps {
  book: BookSummary;
  /** "Chapter 7: The orchard". */
  chapter: string;
  /**
   * Supplies the state and the handlers below in one prop. When given, it wins over the individual props, which keep
   * working for apps that prefer them.
   */
  controller?: AudioPlayerController;
  playing?: boolean;
  /** Seconds. */
  position?: number;
  duration?: number;
  /** Playback speed, for example 1.25. */
  speed?: number;
  /** "Off", "15 min", "End of chapter". */
  sleepLabel?: string;
  skipBackSeconds?: number;
  skipForwardSeconds?: number;
  onTogglePlay?: () => void;
  onSeek?: (seconds: number) => void;
  onSkip?: (deltaSeconds: number) => void;
  /** Cycle to the next speed. */
  onSpeedClick?: () => void;
  onSleepClick?: () => void;
  onChaptersClick?: () => void;
  /** Minimize to the mini-player. */
  onCollapse: () => void;
  /**
   * Box of the cover this player grows out of (a library card or the mini-player). Optional: when left out, the box
   * remembered by the card or mini-player that was just tapped is used (`takeFlipOrigin`).
   */
  originRect?: RectLike;
}

const noop = (): void => undefined;

/**
 * Full audio player (blueprint 5.6): cover with a tint taken from it, title, scrubber, one-thumb controls, and a
 * "time left at your speed" line that changes with the speed chip. Visual shell: the audio controller owns playback.
 * From 1024 px the cover sits left and the controls right.
 */
export function AudioPlayerScreen({
  book,
  chapter,
  controller,
  skipBackSeconds = 15,
  skipForwardSeconds = 30,
  onCollapse,
  originRect,
  ...individual
}: AudioPlayerScreenProps) {
  const playing = controller?.playing ?? individual.playing ?? false;
  const position = controller?.position ?? individual.position ?? 0;
  const duration = controller?.duration ?? individual.duration ?? 0;
  const speed = controller?.speed ?? individual.speed ?? 1;
  const sleepLabel = controller?.sleepLabel ?? individual.sleepLabel ?? 'Off';
  const onTogglePlay = controller?.toggle ?? individual.onTogglePlay ?? noop;
  const onSeek = controller?.seek ?? individual.onSeek ?? noop;
  const onSkip = controller?.skip ?? individual.onSkip ?? noop;
  const onSpeedClick = controller?.cycleSpeed ?? individual.onSpeedClick ?? noop;
  const onSleepClick = controller?.openSleep ?? individual.onSleepClick ?? noop;
  const onChaptersClick = controller?.openChapters ?? individual.onChaptersClick ?? noop;
  const tint = useCoverTint(book.coverUrl);
  const artRef = useRef<HTMLDivElement>(null);
  // Shared transition: the cover grows from its card or the mini-player. Once per mount; transform and opacity only.
  useEffect(() => {
    const origin = originRect ?? takeFlipOrigin();
    if (!origin) return undefined;
    const frame = window.requestAnimationFrame(() => {
      if (artRef.current) playFlip(artRef.current, origin);
    });
    return () => window.cancelAnimationFrame(frame);
    // The origin is read once on purpose: a later prop change must not replay the transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section aria-label="Audio player" className="pn-player pn-tinted" style={tint.style}>
      <header className="pn-player__bar">
        <Button iconOnly variant="ghost" icon="chevronDown" aria-label="Minimize player" onClick={onCollapse} />
        <p className="pn-player__now">Now playing</p>
        <span className="pn-player__spacer" aria-hidden="true" />
      </header>

      <div className="pn-player__layout">
        <div ref={artRef} className="pn-player__art">
          <BookCover title={book.title} author={book.author} src={book.coverUrl} eager />
        </div>
        <div className="pn-player__panel">
          <div className="pn-player__titles">
            <h1 className="pn-player__title">{book.title}</h1>
            <p className="pn-player__author">{book.author ?? 'Unknown author'}</p>
            <p className="pn-player__chapter">{chapter}</p>
          </div>

          <div className="pn-player__scrub">
            <Range
              label="Playback position"
              min={0}
              max={Math.max(1, duration)}
              step={1}
              value={Math.min(position, Math.max(1, duration))}
              valueText={`${formatDuration(position)} of ${formatDuration(duration)}`}
              onChange={onSeek}
            />
            <div className="pn-player__times" aria-hidden="true">
              <span>{formatClock(position)}</span>
              <span>-{formatClock(Math.max(0, duration - position))}</span>
            </div>
            <p className="pn-player__left" aria-live="polite">
              {timeLeftLabel(duration, position, speed)}
            </p>
          </div>

          <div className="pn-player__controls">
            <button type="button" className="pn-player__skip" aria-label={`Back ${skipBackSeconds} seconds`} onClick={() => onSkip(-skipBackSeconds)}>
              <SkipGlyph direction="back" seconds={skipBackSeconds} size={48} />
            </button>
            <button type="button" className="pn-player__play" aria-label={playing ? 'Pause' : 'Play'} onClick={onTogglePlay}>
              <PlayPauseGlyph playing={playing} size={32} />
            </button>
            <button type="button" className="pn-player__skip" aria-label={`Forward ${skipForwardSeconds} seconds`} onClick={() => onSkip(skipForwardSeconds)}>
              <SkipGlyph direction="forward" seconds={skipForwardSeconds} size={48} />
            </button>
          </div>

          <div className="pn-player__chips">
            <Chip icon="gauge" onClick={onSpeedClick} aria-label={`Speed ${formatSpeed(speed)}. Change speed`}>
              {formatSpeed(speed)}
            </Chip>
            <Chip icon="timer" onClick={onSleepClick} aria-label={`Sleep timer: ${sleepLabel}. Change`}>
              Sleep: {sleepLabel}
            </Chip>
            <Chip icon="list" onClick={onChaptersClick}>
              Chapters
            </Chip>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AudioPlayerScreen;
