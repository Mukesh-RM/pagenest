import type { DataClient } from '@/data/data-client';

/**
 * Start-up work that must happen once but must never delay the first paint.
 *
 * `cleanupOrphans()` deletes files that belong to no book (left by a crash or an interrupted import).
 * The data layer allows it exactly once per start, before any import begins, and refuses (with the
 * typed error `cleanup-not-allowed`, deleting nothing) if an import already started; see
 * docs/DATA_LAYER.md, "Startup clean-up". We run it when the browser is idle, a moment after the
 * first screen is up, so it is never on the critical path. The data worker is already running by
 * then (the Library reads its page from it), so this does not start it.
 */

/** Longest the clean-up waits for an idle moment. An import needs a tap, so it cannot start sooner than this in practice. */
export const CLEANUP_IDLE_TIMEOUT_MS = 2000;

export interface StartupLog {
  info(message: string, detail?: unknown): void;
  warn(message: string, detail?: unknown): void;
}

const defaultLog: StartupLog = {
  info: (message, detail) => console.info(`[pagenest] ${message}`, detail ?? ''),
  warn: (message, detail) => console.warn(`[pagenest] ${message}`, detail ?? ''),
};

/** One clean-up per data client for the life of the page, however often the app mounts or re-renders. */
const scheduled = new WeakMap<DataClient, Promise<void>>();

type IdleWindow = {
  requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
};

function whenIdle(run: () => void, win: IdleWindow & Window): void {
  if (typeof win.requestIdleCallback === 'function') win.requestIdleCallback(run, { timeout: CLEANUP_IDLE_TIMEOUT_MS });
  else win.setTimeout(run, 1000);
}

/** The typed error code of a `BookRepositoryError`, without importing the repository into the first-load bundle. */
function errorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Schedule the one start-up `cleanupOrphans()` for `data`. Safe to call more than once: later calls
 * return the same promise and do nothing. The promise never rejects. A failure is logged with its
 * typed code; the app carries on either way (the next start tries again).
 */
export function scheduleStartupCleanup(data: DataClient, options: { log?: StartupLog; win?: IdleWindow & Window } = {}): Promise<void> {
  const existing = scheduled.get(data);
  if (existing) return existing;
  const log = options.log ?? defaultLog;
  const win = options.win ?? window;
  const done = new Promise<void>((resolve) => {
    whenIdle(() => {
      data.books.cleanupOrphans().then(
        (report) => {
          if (report.removedBookIds.length > 0 || report.freedBytes > 0) log.info('Removed leftover files from an interrupted import.', report);
          resolve();
        },
        (error: unknown) => {
          const code = errorCode(error);
          // `cleanup-not-allowed` is expected when an import already began: nothing was deleted, nothing to do.
          if (code === 'cleanup-not-allowed') log.info('Start-up clean-up skipped: an import had already begun.', { code });
          else log.warn('Start-up clean-up failed; it will try again next time.', { code, error });
          resolve();
        },
      );
    }, win);
  });
  scheduled.set(data, done);
  return done;
}

/**
 * Resolves when the start-up clean-up has finished (or was refused or failed), or at once if it was
 * never scheduled. The importer awaits this before its first `add`, so an import can never overlap the clean-up.
 */
export function startupCleanupDone(data: DataClient): Promise<void> {
  return scheduled.get(data) ?? Promise.resolve();
}
