import { useCallback, useEffect, useRef, useState } from 'react';
import { useLibraryRevision } from '@/app/library-hooks';
import { useServices } from '@/app/services-context';
import type { BookSummary, LibraryQuery } from '@/data/library-query';

/** Page size when reading the whole result. The data layer allows at most 500. */
export const PAGE = 500;
/** While books are being added the list refreshes at most this often. */
const REFRESH_MS = 300;

export interface LibraryItems {
  /** Every match, in order. Grows page by page while loading. */
  items: readonly BookSummary[];
  /** How many books match (can be more than `items.length` while the rest is loading). */
  total: number;
  /** Books in the whole library, with no filter: tells "empty library" from "nothing matches". */
  libraryCount: number;
  /** False until the first page arrived, so the screen shows skeletons instead of an empty state. */
  ready: boolean;
  error: Error | undefined;
  /** Change one book on screen right now (the database write follows). */
  patch(id: string, change: Partial<BookSummary>): void;
  /** Take books off the screen right now. */
  remove(ids: readonly string[]): void;
  /** Read again from the data layer (after a failed write, to show the truth). */
  reload(): void;
}

/** A value that follows `value` but changes at most once per `ms` (first change at once, last one always). */
function useThrottled<T>(value: T, ms: number): T {
  const [shown, setShown] = useState(value);
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const wait = last.current + ms - Date.now();
    clearTimeout(timer.current);
    if (wait <= 0) {
      last.current = Date.now();
      setShown(value);
    } else {
      timer.current = setTimeout(() => {
        last.current = Date.now();
        setShown(value);
      }, wait);
    }
    return () => clearTimeout(timer.current);
  }, [value, ms]);
  return shown;
}

/**
 * The library list for a query: the data worker searches, filters and sorts, and this hook reads
 * the result in pages of 500 so the grid can show the first screenful at once. It refreshes when
 * the library changes (also from the import worker or another tab) and keeps the old list on screen
 * until the new one is complete, so the scroll position never jumps.
 */
export function useLibraryItems(query: Partial<LibraryQuery>, extraRefresh: number = 0): LibraryItems {
  const { data } = useServices();
  const revision = useThrottled(useLibraryRevision(), REFRESH_MS);
  const key = JSON.stringify(query);
  const [state, setState] = useState<{ items: readonly BookSummary[]; total: number; libraryCount: number; ready: boolean; error: Error | undefined }>({
    items: [],
    total: 0,
    libraryCount: 0,
    ready: false,
    error: undefined,
  });
  const [manual, setManual] = useState(0);
  const loadedKey = useRef<string | undefined>(undefined);
  const seq = useRef(0);

  useEffect(() => {
    if (revision === undefined) return undefined;
    seq.current += 1;
    const mine = seq.current;
    const q = JSON.parse(key) as Partial<LibraryQuery>;
    const sameQuery = loadedKey.current === key;
    const stale = (): boolean => seq.current !== mine;
    void (async () => {
      try {
        const [libraryCount, first] = await Promise.all([data.library.count(), data.library.query({ ...q, offset: 0, limit: PAGE })]);
        if (stale()) return;
        let items = first.items;
        // A new query shows its first page at once; a refresh waits for the whole list (no jumping).
        if (!sameQuery || items.length >= first.total) {
          setState({ items, total: first.total, libraryCount, ready: true, error: undefined });
          loadedKey.current = key;
        }
        while (items.length < first.total) {
          const next = await data.library.query({ ...q, offset: items.length, limit: PAGE });
          if (stale()) return;
          if (next.items.length === 0) break;
          items = items.concat(next.items);
          if (!sameQuery || items.length >= first.total) setState({ items, total: first.total, libraryCount, ready: true, error: undefined });
        }
        if (sameQuery && items.length < first.total) setState({ items, total: first.total, libraryCount, ready: true, error: undefined });
        loadedKey.current = key;
      } catch (error) {
        if (!stale()) setState((s) => ({ ...s, ready: true, error: error instanceof Error ? error : new Error(String(error)) }));
      }
    })();
    return () => {
      seq.current += 1;
    };
  }, [data, key, revision, manual, extraRefresh]);

  const patch = useCallback((id: string, change: Partial<BookSummary>) => {
    setState((s) => ({ ...s, items: s.items.map((b) => (b.id === id ? { ...b, ...change } : b)) }));
  }, []);
  const remove = useCallback((ids: readonly string[]) => {
    const gone = new Set(ids);
    setState((s) => {
      const items = s.items.filter((b) => !gone.has(b.id));
      return { ...s, items, total: Math.max(0, s.total - (s.items.length - items.length)), libraryCount: Math.max(0, s.libraryCount - (s.items.length - items.length)) };
    });
  }, []);
  const reload = useCallback(() => setManual((n) => n + 1), []);
  return { ...state, patch, remove, reload };
}
