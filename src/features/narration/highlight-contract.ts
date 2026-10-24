/**
 * Highlight follow-along contract for read-aloud (Phase 4 spike).
 *
 * The reader UI subscribes to {@link NarrationHighlightListener} and paints the
 * active range in the chapter text. Engines emit {@link NarrationHighlightEvent}
 * as playback moves; granularity depends on platform support.
 *
 * @see docs/NARRATION_SPIKE.md — “Highlight follow-along contract”
 */

/** How precisely the engine can report position within a sentence. */
export type HighlightGranularity = 'character' | 'sentence';

/**
 * One highlight update. `textStart` / `textEnd` are UTF-16 code unit offsets in the
 * full chapter (or passage) string passed to {@link SpeechNarrationSession.start}.
 */
export interface NarrationHighlightEvent {
  /** Zero-based index of the sentence currently being spoken. */
  readonly sentenceIndex: number;
  /** Inclusive start offset of that sentence in the passage text. */
  readonly textStart: number;
  /** Exclusive end offset of that sentence in the passage text. */
  readonly textEnd: number;
  readonly granularity: HighlightGranularity;
  /**
   * When `granularity === 'character'`, offset within the sentence (0 = first char).
   * Omitted for sentence-level updates.
   */
  readonly charOffsetInSentence?: number;
  /** Length of the highlighted span when `granularity === 'character'`. */
  readonly charLength?: number;
}

export type NarrationHighlightListener = (event: NarrationHighlightEvent) => void;

/** Playback lifecycle signals for UI (mini-player, scrubber). */
export type NarrationPlaybackState = 'idle' | 'playing' | 'paused' | 'stopped';

export interface NarrationPlaybackStatus {
  readonly state: NarrationPlaybackState;
  /** Index of the sentence currently playing or paused on; `-1` when idle. */
  readonly sentenceIndex: number;
  /** Speed multiplier in the closed interval [0.5, 3]. */
  readonly rate: number;
}
