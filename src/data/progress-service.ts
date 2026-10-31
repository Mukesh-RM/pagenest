import {
  clampPercent,
  isLocator,
  isLocatorForMode,
  type EntityId,
  type Locator,
  type ProgressMode,
  type ProgressRecord,
  type ProgressService,
  type Unsubscribe,
} from '@/app/contracts';
import type { PageNestDB } from './db';
import { isDatabaseClosedError } from './db-errors';
import type { ProgressRow } from './schema';

/** Default write interval from blueprint section 8.1 (position saved every 5 seconds). */
export const DEFAULT_SAVE_INTERVAL_MS = 5000;

export interface DexieProgressServiceOptions {
  /** Milliseconds between automatic writes of reported positions. */
  intervalMs?: number;
  /** Clock, replaceable in tests. */
  now?: () => number;
}

interface Pending {
  bookId: EntityId;
  mode: ProgressMode;
  locator: Locator;
  percent: number;
}

const keyOf = (bookId: EntityId, mode: ProgressMode): string => `${bookId}\u0000${mode}`;

/**
 * IndexedDB-backed {@link ProgressService}. See `docs/PROGRESS_SERVICE.md`.
 *
 * `report()` keeps only the newest position per (book, mode) and one timer
 * writes them all `intervalMs` after the first unsaved report, so a busy
 * scroll or time-update handler produces at most one write per interval.
 */
export class DexieProgressService implements ProgressService {
  private readonly pending = new Map<string, Pending>();
  private readonly listeners = new Set<(record: ProgressRecord) => void>();
  private readonly intervalMs: number;
  private readonly now: () => number;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Serializes writes so an older position can never overwrite a newer one. */
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly db: PageNestDB,
    options: DexieProgressServiceOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? DEFAULT_SAVE_INTERVAL_MS;
    this.now = options.now ?? Date.now;
  }

  async get(bookId: EntityId, mode: ProgressMode): Promise<ProgressRecord | undefined> {
    const pending = this.pending.get(keyOf(bookId, mode));
    if (pending) return this.toRecord(pending);
    await this.writeChain.catch(() => undefined);
    try {
      const row = await this.db.progress.get([bookId, mode]);
      return row && isLocator(row.locator) ? row : undefined;
    } catch (error) {
      if (isDatabaseClosedError(error)) return undefined;
      throw error;
    }
  }

  async getLatest(bookId: EntityId): Promise<ProgressRecord | undefined> {
    await this.writeChain.catch(() => undefined);
    let rows: ProgressRow[];
    try {
      rows = await this.db.progress.where('bookId').equals(bookId).toArray();
    } catch (error) {
      if (isDatabaseClosedError(error)) return undefined;
      throw error;
    }
    const candidates: ProgressRecord[] = rows.filter((r) => isLocator(r.locator));
    for (const p of this.pending.values()) {
      if (p.bookId === bookId) candidates.push(this.toRecord(p));
    }
    return candidates.reduce<ProgressRecord | undefined>(
      (best, r) => (!best || r.updatedAt >= best.updatedAt ? r : best),
      undefined,
    );
  }

  report(bookId: EntityId, mode: ProgressMode, locator: Locator, percent: number): void {
    this.assertValid(mode, locator);
    this.pending.set(keyOf(bookId, mode), { bookId, mode, locator, percent: clampPercent(percent) });
    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.intervalMs);
  }

  async save(
    bookId: EntityId,
    mode: ProgressMode,
    locator: Locator,
    percent: number,
  ): Promise<ProgressRecord> {
    this.assertValid(mode, locator);
    this.pending.delete(keyOf(bookId, mode));
    return this.write({ bookId, mode, locator, percent: clampPercent(percent) });
  }

  async flush(bookId?: EntityId): Promise<void> {
    const batch: Pending[] = [];
    for (const [key, p] of this.pending) {
      if (bookId === undefined || p.bookId === bookId) {
        batch.push(p);
        this.pending.delete(key);
      }
    }
    if (this.pending.size === 0 && this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    await Promise.all(batch.map((p) => this.write(p).catch((error) => {
      if (isDatabaseClosedError(error)) return this.toRecord(p);
      throw error;
    })));
    await this.writeChain.catch(() => undefined);
  }

  async clear(bookId: EntityId): Promise<void> {
    for (const [key, p] of this.pending) {
      if (p.bookId === bookId) this.pending.delete(key);
    }
    await this.writeChain.catch(() => undefined);
    try {
      await this.db.progress.where('bookId').equals(bookId).delete();
    } catch (error) {
      if (isDatabaseClosedError(error)) return;
      throw error;
    }
  }

  /** Tests and teardown: stop timers and wait for in-flight writes without touching the database again. */
  async dispose(): Promise<void> {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.pending.clear();
    await this.writeChain.catch(() => undefined);
    this.listeners.clear();
  }

  subscribe(listener: (record: ProgressRecord) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private assertValid(mode: ProgressMode, locator: Locator): void {
    if (!isLocator(locator) || !isLocatorForMode(locator, mode)) {
      throw new RangeError(`A ${String((locator as { kind?: unknown })?.kind)} locator is not valid for mode "${mode}".`);
    }
  }

  private toRecord(p: Pending): ProgressRecord {
    return { ...p, updatedAt: this.now() };
  }

  private write(p: Pending): Promise<ProgressRecord> {
    const record = this.toRecord(p);
    const run = async (): Promise<ProgressRecord> => {
      try {
        await this.db.transaction('rw', this.db.progress, this.db.books, async () => {
          await this.db.progress.put(record);
          await this.db.books.where('id').equals(record.bookId).modify({ lastOpenedAt: record.updatedAt });
        });
      } catch (error) {
        if (isDatabaseClosedError(error)) throw error;
        throw error;
      }
      for (const listener of [...this.listeners]) listener(record);
      return record;
    };
    const result = this.writeChain.then(run, run);
    this.writeChain = result.catch((error) => {
      if (isDatabaseClosedError(error)) return undefined;
      return undefined;
    });
    return result;
  }
}

/** Anything that can fire `visibilitychange` or `pagehide`: `document` and `window` qualify. */
export interface LifecycleTarget {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/**
 * Flush pending progress when the page is hidden or closed, so a killed app
 * still resumes at the same spot. Pass `document` as `visibility` and `window`
 * as `page`. Returns a function that removes the listeners.
 */
export function attachProgressLifecycle(
  service: ProgressService,
  targets: { visibility: LifecycleTarget & { visibilityState?: string }; page: LifecycleTarget },
): Unsubscribe {
  const onVisibility = (): void => {
    if (targets.visibility.visibilityState === 'hidden') void service.flush();
  };
  const onPageHide = (): void => {
    void service.flush();
  };
  targets.visibility.addEventListener('visibilitychange', onVisibility);
  targets.page.addEventListener('pagehide', onPageHide);
  return () => {
    targets.visibility.removeEventListener('visibilitychange', onVisibility);
    targets.page.removeEventListener('pagehide', onPageHide);
  };
}
