import type { EntityId, Locator, Unsubscribe } from '@/app/contracts';

/**
 * Audio controller contract (blueprint sections 8 and 12.2).
 *
 * There is exactly one `AudioController` per app and it owns the single HTML
 * audio element. Audio state lives here and never inside components, so a
 * screen can close without stopping playback. Read-aloud audio (rendered
 * chapters from the narration pipeline) plays through the same controller.
 *
 * Rules the implementation must follow:
 * - Playback starts only from a user gesture; never autoplay.
 * - Files come from OPFS as local object URLs; no network.
 * - Media Session metadata and actions are kept in sync with this state.
 * - Position is saved through the ProgressService every 5 s, on pause, on page
 *   hide and on every track change.
 */
export interface AudioController {
  /** Current state snapshot. Cheap; never throws. */
  getState(): AudioState;

  /** Listen for state changes. `position` changes are batched to at most ~4 per second. */
  subscribe(listener: (state: AudioState) => void): Unsubscribe;

  /**
   * Prepare a book and optionally seek to a saved position. Does not start
   * playing. Replaces any currently loaded item (its position is saved first).
   */
  load(item: AudioItem, start?: Locator): Promise<void>;

  /** Start or resume. Must be called from a user gesture. Resolves when audio is playing. */
  play(): Promise<void>;
  pause(): void;
  toggle(): Promise<void>;
  /** Pause, save the position and unload. */
  stop(): Promise<void>;

  /** Seek to a position in the whole book, in seconds from its start. */
  seekTo(bookPositionSec: number): void;
  /** Move by `deltaSec` (negative goes back); clamps to the book. */
  skip(deltaSec: number): void;
  /** Jump to chapter `index`; ignored when out of range. */
  goToChapter(index: number): void;
  nextChapter(): void;
  previousChapter(): void;

  /** Playback rate, 0.5 to 3, pitch preserved. Values outside the range are clamped. */
  setSpeed(rate: number): void;
  /** Settings for skip buttons and smart rewind. */
  setOptions(options: Partial<AudioOptions>): void;

  /** Start a sleep timer, or cancel it with `null`. Based on the audio clock. */
  setSleepTimer(timer: SleepTimerSpec | null): void;
  /** Add time to a running sleep timer (shake or tap to extend). */
  extendSleepTimer(extraSec: number): void;
}

/** What is being played. */
export interface AudioItem {
  readonly bookId: EntityId;
  readonly title: string;
  readonly author?: string;
  readonly narrator?: string;
  /** Cover image for the lock screen, if any. */
  readonly cover?: Blob;
  /** Files in play order. One entry for M4B, one per file for a folder of MP3s. */
  readonly tracks: readonly AudioTrack[];
  /** Chapters over the whole book; empty means evenly spaced markers are made by the app. */
  readonly chapters: readonly AudioChapter[];
}

/** One audio file. Field names match the `tracks` store. */
export interface AudioTrack {
  readonly index: number;
  /** Provides the file bytes (read from OPFS). Called once per load of the track. */
  readonly open: () => Promise<Blob>;
  readonly title: string;
  readonly durationSec: number;
  /** Seconds from the start of the book to the start of this track. */
  readonly startOffsetSec: number;
}

/** A chapter marker in book time. */
export interface AudioChapter {
  readonly index: number;
  readonly title: string;
  /** Seconds from the start of the book. */
  readonly startSec: number;
}

/** Playback status. */
export type PlaybackStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

/** Everything the UI needs to draw the mini-player and the full player. */
export interface AudioState {
  readonly status: PlaybackStatus;
  /** The loaded item, or `undefined` when idle. */
  readonly item?: AudioItem;
  /** Seconds from the start of the book. */
  readonly positionSec: number;
  /** Total book length in seconds. */
  readonly durationSec: number;
  /** Index of the current chapter, or -1 when idle. */
  readonly chapterIndex: number;
  /** Seconds left in the current chapter and in the book, at the current speed. */
  readonly chapterRemainingSec: number;
  readonly bookRemainingSec: number;
  /** Current position as a locator (what the ProgressService stores). */
  readonly locator?: Locator;
  readonly speed: number;
  readonly options: AudioOptions;
  /** Remaining sleep timer, or `undefined` when none runs. */
  readonly sleep?: SleepTimerState;
  /** Plain-words message when `status` is `error`. */
  readonly errorMessage?: string;
}

/** User settings for skipping (blueprint section 8.3). */
export interface AudioOptions {
  readonly skipBackSec: 10 | 15 | 30 | 60;
  readonly skipForwardSec: 10 | 15 | 30 | 60;
  /** Jump back a few seconds after a long pause. 0 turns it off. */
  readonly smartRewindSec: number;
}

/** Sleep timer request. */
export type SleepTimerSpec =
  | { readonly kind: 'minutes'; readonly minutes: number }
  | { readonly kind: 'endOfChapter' };

/** A running sleep timer. */
export interface SleepTimerState {
  readonly spec: SleepTimerSpec;
  /** Seconds until pause, measured on the audio clock. */
  readonly remainingSec: number;
  /** True during the gentle fade-out. */
  readonly fading: boolean;
}
