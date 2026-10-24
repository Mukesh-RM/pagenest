import type { EntityId, ProgressMode, Unsubscribe } from './common';
import type { Locator } from './locator';

/**
 * One saved position (blueprint section 13, `progress` store).
 * There is at most one record per `(bookId, mode)` pair.
 */
export interface ProgressRecord {
  readonly bookId: EntityId;
  readonly mode: ProgressMode;
  readonly locator: Locator;
  /** Overall progress through the book, 0 to 100. */
  readonly percent: number;
  /** Epoch milliseconds of the last save. */
  readonly updatedAt: number;
}

/**
 * The single place where reading, listening and read-aloud positions are
 * saved and restored (blueprint section 12.2).
 *
 * Full contract, including timing rules and failure behavior, is in
 * `docs/PROGRESS_SERVICE.md`. Short version:
 * - Engines call {@link ProgressService.report} as often as they like;
 *   the service writes at most once per interval (default 5 s) per book and mode.
 * - Engines and features call {@link ProgressService.flush} on pause, page hide
 *   and close, and {@link ProgressService.save} for one-off exact saves.
 * - Anything that resumes calls {@link ProgressService.get} or
 *   {@link ProgressService.getLatest}.
 */
export interface ProgressService {
  /** The saved position for one mode, or `undefined` if there is none. */
  get(bookId: EntityId, mode: ProgressMode): Promise<ProgressRecord | undefined>;

  /** The most recently saved position across all modes ("resume where I was"). */
  getLatest(bookId: EntityId): Promise<ProgressRecord | undefined>;

  /**
   * Remember a position and schedule a write. Cheap and synchronous, so it is
   * safe to call from a scrolling or time-update handler. Pending reports for
   * the same `(bookId, mode)` are replaced by the newest one.
   *
   * @throws RangeError if `locator` is not valid for `mode` (see `isLocatorForMode`).
   */
  report(bookId: EntityId, mode: ProgressMode, locator: Locator, percent: number): void;

  /**
   * Write a position now, bypassing the interval, and drop any pending report
   * for the same key. Resolves with the stored record.
   *
   * @throws RangeError if `locator` is not valid for `mode`.
   */
  save(bookId: EntityId, mode: ProgressMode, locator: Locator, percent: number): Promise<ProgressRecord>;

  /**
   * Write every pending report now (or only those of `bookId`). Call on pause,
   * page hide, close and track change. Resolves when all writes finished.
   */
  flush(bookId?: EntityId): Promise<void>;

  /** Delete all saved positions of a book (used when the book is deleted). */
  clear(bookId: EntityId): Promise<void>;

  /**
   * Listen for saved positions, for example so the library can refresh a
   * progress bar. Called after each successful write.
   */
  subscribe(listener: (record: ProgressRecord) => void): Unsubscribe;
}
