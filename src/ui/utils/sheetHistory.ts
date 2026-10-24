/**
 * Back-button handling for stacked sheets.
 *
 * Each open sheet pushes one history entry. The system back gesture (popstate) then closes the
 * top sheet first, before any route change (blueprint 5.5). When a sheet is closed another way
 * (Esc, scrim, button) its entry is popped again so history stays clean.
 *
 * Rules:
 * - Sheets close in last-opened-first order when back is pressed.
 * - A sheet closed out of order leaves a "stale" entry; it is skipped when reached.
 * - A history.back() we trigger ourselves is counted in `ignore` so it never closes anything.
 * - A sheet opened while one of our own history.back() calls is still pending waits for it, so
 *   the new entry is not swallowed by the pending traversal.
 */

export interface SheetEntry {
  readonly id: number;
  close: () => void;
  stale: boolean;
  pushed: boolean;
}

const entries: SheetEntry[] = [];
let ignore = 0;
let nextId = 1;
let listening = false;

function pushEntry(entry: SheetEntry): void {
  const state: unknown = window.history.state;
  const base = state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
  window.history.pushState({ ...base, pnSheet: entry.id }, '');
  entry.pushed = true;
}

function flushPending(): void {
  if (ignore > 0) return;
  for (const entry of entries) {
    if (!entry.pushed) pushEntry(entry);
  }
}

function backSilently(): void {
  ignore += 1;
  window.history.back();
}

function onPopState(): void {
  if (ignore > 0) {
    ignore -= 1;
    flushPending();
    return;
  }
  // Pop the newest pushed entry.
  let index = entries.length - 1;
  while (index >= 0 && !entries[index]!.pushed) index -= 1;
  if (index < 0) return;
  const [entry] = entries.splice(index, 1);
  if (!entry) return;
  if (entry.stale) {
    // The sheet for this entry was already closed; keep going so back closes a real sheet.
    window.history.back();
    return;
  }
  entry.close();
}

/** Remove stale entries sitting on top of the history stack. */
function settle(): void {
  for (;;) {
    const last = entries[entries.length - 1];
    if (!last || !last.stale) return;
    entries.pop();
    backSilently();
  }
}

/**
 * Register an open sheet. `close` is called when the system back gesture should close it.
 * The returned function must be called when the sheet closes or unmounts.
 */
export function registerSheet(close: () => void): { entry: SheetEntry; release: () => void } {
  if (!listening) {
    window.addEventListener('popstate', onPopState);
    listening = true;
  }
  const entry: SheetEntry = { id: nextId++, close, stale: false, pushed: false };
  entries.push(entry);
  if (ignore === 0) pushEntry(entry);

  const release = () => {
    const index = entries.indexOf(entry);
    if (index < 0) return; // already popped by the back gesture
    if (!entry.pushed) {
      entries.splice(index, 1);
      return;
    }
    if (index === entries.length - 1) {
      entries.pop();
      backSilently();
      settle();
    } else {
      entry.stale = true;
    }
  };
  return { entry, release };
}

/** True when `entry` is the newest live sheet (the one Esc and back should act on). */
export function isTopSheet(entry: SheetEntry): boolean {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const candidate = entries[i]!;
    if (!candidate.stale) return candidate === entry;
  }
  return false;
}

/** Test helper: forget all state. */
export function resetSheetHistoryForTests(): void {
  entries.length = 0;
  ignore = 0;
  if (listening) window.removeEventListener('popstate', onPopState);
  listening = false;
}

let scrollLocks = 0;
let previousOverflow = '';

/** Lock page scroll while any sheet is open. Returns an unlock function. */
export function lockScroll(): () => void {
  if (scrollLocks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLocks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks -= 1;
    if (scrollLocks === 0) document.body.style.overflow = previousOverflow;
  };
}
