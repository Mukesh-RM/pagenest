import { BookCover } from '../components/BookCover';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Range } from '../components/Range';
import { useCoverTint } from '../hooks';
import type { BookSummary } from '../types';
import { formatClock, formatSpeed, formatDuration, timeLeftLabel } from '../utils/time';

export interface AudioPlayerScreenProps {
  book: BookSummary;
  /** "Chapter 7: The orchard". */
  chapter: string;
  playing: boolean;
  /** Seconds. */
  position: number;
  duration: number;
  /** Playback speed, for example 1.25. */
  speed: number;
  /** "Off", "15 min", "End of chapter". */
  sleepLabel: string;
  skipBackSeconds?: number;
  skipForwardSeconds?: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (deltaSeconds: number) => void;
  /** Cycle to the next speed. */
  onSpeedClick: () => void;
  onSleepClick: () => void;
  onChaptersClick: () => void;
  /** Minimize to the mini-player. */
  onCollapse: () => void;
}

/**
 * Full audio player (blueprint 5.6): cover with a tint taken from it, title, scrubber, one-thumb controls, and a
 * "time left at your speed" line that changes with the speed chip. Visual shell: the audio controller owns playback.
 * From 1024 px the cover sits left and the controls right.
 */
export function AudioPlayerScreen({
  book,
  chapter,
  playing,
  position,
  duration,
  speed,
  sleepLabel,
  skipBackSeconds = 15,
  skipForwardSeconds = 30,
  onTogglePlay,
  onSeek,
  onSkip,
  onSpeedClick,
  onSleepClick,
  onChaptersClick,
  onCollapse,
}: AudioPlayerScreenProps) {
  const tint = useCoverTint(book.coverUrl);
  return (
    <section aria-label="Audio player" className="pn-player pn-tinted" style={tint.style}>
      <header className="pn-player__bar">
        <Button iconOnly variant="ghost" icon="chevronDown" aria-label="Minimize player" onClick={onCollapse} />
        <p className="pn-player__now">Now playing</p>
        <span className="pn-player__spacer" aria-hidden="true" />
      </header>

      <div className="pn-player__layout">
        <div className="pn-player__art">
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
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span className="pn-player__skip-n">{skipBackSeconds}</span>
            </button>
            <button type="button" className="pn-player__play" aria-label={playing ? 'Pause' : 'Play'} onClick={onTogglePlay}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                {playing ? (
                  <>
                    <rect x="14" y="3" width="5" height="18" rx="1" />
                    <rect x="5" y="3" width="5" height="18" rx="1" />
                  </>
                ) : (
                  <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
                )}
              </svg>
            </button>
            <button type="button" className="pn-player__skip" aria-label={`Forward ${skipForwardSeconds} seconds`} onClick={() => onSkip(skipForwardSeconds)}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span className="pn-player__skip-n">{skipForwardSeconds}</span>
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
