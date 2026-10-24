import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PlayPauseGlyph, SkipGlyph } from '../components/PlayGlyphs';
import { BookCover } from '../components/BookCover';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { OverflowMenu, type OverflowMenuItem } from '../components/OverflowMenu';
import { Range } from '../components/Range';
import { useCoverTint } from '../hooks';
import { useShortcutBindings, useShortcuts } from '../shortcuts';
import type { BookSummary, PlayerBookmark } from '../types';
import { playFlip, takeFlipOrigin, type RectLike } from '../utils/flip';
import { formatClock, formatSpeed, formatDuration, timeLeftLabel } from '../utils/time';
import { BookmarksSheet } from './BookmarksSheet';
import { SkipIntervalSheet } from './SkipIntervalSheet';
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
  /** Length of the Back and Forward buttons in seconds (the engine's `AudioOptions.skipBackSec` / `skipForwardSec`). */
  skipBackSeconds?: number;
  skipForwardSeconds?: number;
  /** The user picked a new length: `engine.setOptions({ skipBackSec })` or `{ skipForwardSec }`. */
  setSkipInterval?: (direction: 'back' | 'forward', seconds: number) => void;
  /** Bookmarks of this book, and what the player can do with them. */
  bookmarks?: readonly PlayerBookmark[];
  /** Add a bookmark at `positionSec` (seconds from the start of the book). */
  addBookmark?: (positionSec: number) => void;
  removeBookmark?: (bookmark: PlayerBookmark) => void;
  /** The app shows its own bookmarks list instead of the built-in sheet. */
  openBookmarks?: () => void;
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
  /** Length of the Back button in seconds. Default 15 (the engine accepts 10, 15, 30 or 60). */
  skipBackSeconds?: number;
  /** Length of the Forward button in seconds. Default 30. */
  skipForwardSeconds?: number;
  /**
   * The user chose a new skip length (hold a skip button, or "Skip buttons" in the ⋯ menu). The app stores it
   * and passes it back in `skipBackSeconds` / `skipForwardSeconds`. Without it the lengths are fixed and the chooser is hidden.
   */
  onSkipIntervalChange?: (direction: 'back' | 'forward', seconds: number) => void;
  /** Lengths offered by the chooser. Default `SKIP_INTERVALS` = 10, 15, 30, 60 (what the engine accepts). */
  skipIntervals?: readonly number[];
  /** Bookmarks of this book. With this (or `onOpenBookmarks`) the ⋯ menu gets "Bookmarks". */
  bookmarks?: readonly PlayerBookmark[];
  /** Shows the "Bookmark" chip. Called with the current position in seconds from the start of the book. */
  onAddBookmark?: (positionSec: number) => void;
  /** Delete button in the built-in bookmarks sheet. */
  onDeleteBookmark?: (bookmark: PlayerBookmark) => void;
  /** Open your own bookmarks list. When given, the built-in sheet is not used. */
  onOpenBookmarks?: () => void;
  /** Space, arrows (the skip lengths) and B (bookmark) work on a laptop. Default true; the app's shortcut provider is then not needed for the player. */
  shortcuts?: boolean;
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
 * Press and hold (or the context-menu key, or a right click) calls `onHold`; the click that ends a hold is swallowed so
 * the button does not also skip. Does nothing without a handler.
 */
function useHold(onHold: (() => void) | undefined, ms = 500) {
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const clear = useCallback(() => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);
  useEffect(() => clear, [clear]);
  if (!onHold) return {};
  return {
    onPointerDown: (event: ReactPointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      held.current = false;
      clear();
      timer.current = window.setTimeout(() => {
        held.current = true;
        timer.current = undefined;
        onHold();
      }, ms);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      clear();
      held.current = true;
      onHold();
    },
    onClickCapture: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (!held.current) return;
      held.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}

/**
 * Full audio player (blueprint 5.6): cover with a tint taken from it, title, scrubber, one-thumb controls, and a
 * "time left at your speed" line that changes with the speed chip. Visual shell: the audio controller owns playback.
 * From 1024 px the cover sits left and the controls right.
 */
export function AudioPlayerScreen({
  book,
  chapter,
  controller,
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
  const skipBackSeconds = controller?.skipBackSeconds ?? individual.skipBackSeconds ?? 15;
  const skipForwardSeconds = controller?.skipForwardSeconds ?? individual.skipForwardSeconds ?? 30;
  const onSkipIntervalChange = controller?.setSkipInterval ?? individual.onSkipIntervalChange;
  const bookmarks = controller?.bookmarks ?? individual.bookmarks;
  const onAddBookmark = controller?.addBookmark ?? individual.onAddBookmark;
  const onDeleteBookmark = controller?.removeBookmark ?? individual.onDeleteBookmark;
  const onOpenBookmarks = controller?.openBookmarks ?? individual.onOpenBookmarks;
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const addBookmark = onAddBookmark
    ? () => {
        onAddBookmark(position);
        setBookmarkNote(`Bookmark added at ${formatClock(position)}`);
      }
    : undefined;
  const openBookmarks = () => (onOpenBookmarks ? onOpenBookmarks() : setBookmarksOpen(true));
  const hasBookmarkList = bookmarks !== undefined || onOpenBookmarks !== undefined;
  const hold = useHold(onSkipIntervalChange ? () => setSkipOpen(true) : undefined);
  const hasToggle = !!(controller?.toggle ?? individual.onTogglePlay);
  const hasSkip = !!(controller?.skip ?? individual.onSkip);
  useShortcuts(
    {
      ...(hasToggle ? { playPause: () => onTogglePlay() } : {}),
      ...(hasSkip ? { seekBack: () => onSkip(-skipBackSeconds), seekForward: () => onSkip(skipForwardSeconds) } : {}),
      ...(addBookmark ? { bookmark: addBookmark } : {}),
    },
    { bindings: useShortcutBindings(), enabled: (individual.shortcuts ?? true) && !bookmarksOpen && !skipOpen },
  );
  const menuItems: OverflowMenuItem[] = [];
  if (hasBookmarkList) {
    menuItems.push({ label: bookmarks ? `Bookmarks (${bookmarks.length})` : 'Bookmarks', icon: 'bookmark', onSelect: openBookmarks });
  }
  if (onSkipIntervalChange) menuItems.push({ label: 'Skip buttons', icon: 'rotateCw', onSelect: () => setSkipOpen(true) });
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
        {menuItems.length > 0 ? <OverflowMenu label="More options" items={menuItems} placement="down" /> : <span className="pn-player__spacer" aria-hidden="true" />}
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
            <button type="button" className="pn-player__skip" aria-label={`Back ${skipBackSeconds} seconds`} title={onSkipIntervalChange ? 'Hold to change' : undefined} onClick={() => onSkip(-skipBackSeconds)} {...hold}>
              <SkipGlyph direction="back" seconds={skipBackSeconds} size={48} />
            </button>
            <button type="button" className="pn-player__play" aria-label={playing ? 'Pause' : 'Play'} onClick={onTogglePlay}>
              <PlayPauseGlyph playing={playing} size={32} />
            </button>
            <button type="button" className="pn-player__skip" aria-label={`Forward ${skipForwardSeconds} seconds`} title={onSkipIntervalChange ? 'Hold to change' : undefined} onClick={() => onSkip(skipForwardSeconds)} {...hold}>
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
            {addBookmark ? (
              <Chip icon="bookmark" onClick={addBookmark} aria-label={`Add bookmark at ${formatClock(position)}`}>
                Bookmark
              </Chip>
            ) : null}
            <Chip icon="list" onClick={onChaptersClick}>
              Chapters
            </Chip>
          </div>
          <p className="pn-visually-hidden" role="status">
            {bookmarkNote}
          </p>
        </div>
      </div>
      {bookmarks !== undefined && !onOpenBookmarks ? (
        <BookmarksSheet
          open={bookmarksOpen}
          onClose={() => setBookmarksOpen(false)}
          bookmarks={bookmarks}
          onSeek={onSeek}
          onAdd={addBookmark}
          onDelete={onDeleteBookmark}
        />
      ) : null}
      {onSkipIntervalChange ? (
        <SkipIntervalSheet
          open={skipOpen}
          onClose={() => setSkipOpen(false)}
          back={skipBackSeconds}
          forward={skipForwardSeconds}
          intervals={individual.skipIntervals}
          onChange={onSkipIntervalChange}
        />
      ) : null}
    </section>
  );
}

export default AudioPlayerScreen;
