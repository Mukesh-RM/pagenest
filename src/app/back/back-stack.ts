import type { Unsubscribe } from '@/app/contracts';

/** History state key that marks entries pushed by {@link BackStack}. Its value is the sheet depth. */
export const BACK_DEPTH_KEY = 'pnBackDepth';

/** Handle for one open sheet. Opaque to callers; pass it back to {@link BackStack.release}. */
export interface BackToken {
  readonly id: number;
}

interface Entry {
  readonly token: BackToken;
  readonly onClose: () => void;
}

/** The slice of `window` that {@link BackStack} uses. Tests can pass a fake. */
export interface HistoryHost {
  readonly history: Pick<History, 'pushState' | 'go' | 'state'>;
  addEventListener(type: 'popstate', listener: (event: PopStateEvent) => void): void;
  removeEventListener(type: 'popstate', listener: (event: PopStateEvent) => void): void;
}

/**
 * Makes the system back gesture close the topmost open sheet before it
 * navigates screens (blueprint 5.5, "Back behavior").
 *
 * Model: a logical stack of open sheets, plus one browser history entry per
 * sheet. Opening a sheet adds an entry; the back gesture removes one, and the
 * stack closes its top sheet. Closing a sheet in code (a Close button, Escape)
 * removes the entry again with `history.go(-1)`, so history never fills up.
 *
 * History entries only carry a depth number (`pnBackDepth`), never which sheet
 * they belong to. That keeps nested sheets, closing a lower sheet first, and
 * React StrictMode's mount, unmount, mount sequence simple and consistent:
 * history is brought in line with the stack in one microtask, so a sheet that
 * is released and re-registered in the same tick causes no history change.
 *
 * Framework-free on purpose; React wiring is in `BackStackProvider` and
 * `useBackClose`.
 */
export class BackStack {
  private readonly entries: Entry[] = [];
  /** How many history entries we believe we have pushed and are still at or behind the current one. */
  private pushed = 0;
  private nextId = 1;
  private syncQueued = false;

  constructor(private readonly host: HistoryHost = window) {}

  /** Number of sheets currently open. */
  get size(): number {
    return this.entries.length;
  }

  /** Start listening for the back gesture. Returns a function that stops. Safe to call more than once. */
  attach(): Unsubscribe {
    this.host.addEventListener('popstate', this.onPopState);
    return () => this.host.removeEventListener('popstate', this.onPopState);
  }

  /**
   * Register an open sheet. `onClose` runs when the user goes back or when
   * {@link BackStack.dropAll} is called; it must close the sheet in the UI.
   * It does not run for {@link BackStack.release}.
   */
  push(onClose: () => void): BackToken {
    const token: BackToken = { id: this.nextId++ };
    this.entries.push({ token, onClose });
    this.queueSync();
    return token;
  }

  /**
   * The sheet was closed in code. Removes it from the stack, wherever it is,
   * and its history entry. Unknown or already released tokens are ignored.
   */
  release(token: BackToken): void {
    const index = this.entries.findIndex((e) => e.token === token);
    if (index === -1) return;
    this.entries.splice(index, 1);
    this.queueSync();
  }

  /**
   * Close every open sheet without touching history. Call after the route
   * changed: the old entries stay in history and are skipped when reached.
   */
  dropAll(): void {
    const dropped = this.entries.splice(0).reverse();
    // After a route change the current entry has no depth marker.
    this.pushed = 0;
    for (const entry of dropped) entry.onClose();
  }

  private queueSync(): void {
    if (this.syncQueued) return;
    this.syncQueued = true;
    queueMicrotask(() => {
      this.syncQueued = false;
      this.sync();
    });
  }

  /** Bring history in line with the stack: push missing entries, go back over extra ones. */
  private sync(): void {
    const want = this.entries.length;
    if (want > this.pushed) {
      const base = (this.host.history.state ?? {}) as Record<string, unknown>;
      for (let depth = this.pushed + 1; depth <= want; depth++) {
        this.host.history.pushState({ ...base, [BACK_DEPTH_KEY]: depth }, '');
      }
      this.pushed = want;
    } else if (want < this.pushed) {
      const extra = this.pushed - want;
      this.pushed = want;
      this.host.history.go(-extra);
    }
  }

  private readonly onPopState = (event: PopStateEvent): void => {
    const state = event.state as Record<string, unknown> | null;
    const raw = state?.[BACK_DEPTH_KEY];
    const depth = typeof raw === 'number' ? raw : 0;
    const open = this.entries.length;

    if (depth > open) {
      // Forward into an entry whose sheet is gone: step back over it.
      this.pushed = open;
      this.host.history.go(-(depth - open));
      return;
    }

    this.pushed = depth;
    // Back gesture: close the topmost sheets, one per entry that was left.
    while (this.entries.length > depth) {
      const entry = this.entries.pop();
      entry?.onClose();
    }
  };
}
