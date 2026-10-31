import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import type { LibraryPage, LibraryQuery } from '@/data/library-query';
import { useServices } from './services-context';

/**
 * A value that is a new object every time something that changes what the Library shows is written:
 * a book, a shelf, a shelf link or a progress row (also from another tab or the import worker).
 * `undefined` until the first read. It only counts rows, so it is cheap and never loads data.
 */
export function useLibraryRevision(): object | undefined {
  const { db } = useServices();
  return useLiveQuery(async () => {
    await Promise.all([db.books.count(), db.collections.count(), db.collectionBooks.count(), db.progress.count()]);
    return {};
  }, [db]);
}

export interface LibraryPageState {
  /** The newest result. Stays on screen while the next one loads, so the list never flashes empty. */
  readonly page: LibraryPage | undefined;
  /** The last request failed (the previous `page`, if any, is still there). */
  readonly error: Error | undefined;
}

/**
 * One page of the Library (search, filter, sort, shelf) from the data worker, kept up to date.
 *
 * - Runs again when `query` changes or the library changes (see {@link useLibraryRevision}).
 * - Answers that arrive late or out of order are dropped; the screen only ever shows the newest.
 * - Pass a plain object; it is compared by value, so an inline literal does not loop.
 */
export function useLibraryPage(query: Partial<LibraryQuery>): LibraryPageState {
  const { data } = useServices();
  const revision = useLibraryRevision();
  const key = JSON.stringify(query);
  const [state, setState] = useState<LibraryPageState>({ page: undefined, error: undefined });
  const latest = useRef(0);

  useEffect(() => {
    if (revision === undefined) return undefined;
    latest.current += 1;
    const mine = latest.current;
    data.library.query(JSON.parse(key) as Partial<LibraryQuery>).then(
      (page) => {
        if (latest.current === mine) setState({ page, error: undefined });
      },
      (error: unknown) => {
        if (latest.current === mine) setState((s) => ({ page: s.page, error: error instanceof Error ? error : new Error(String(error)) }));
      },
    );
    return () => {
      // A newer request, or leaving the screen: whatever this one returns is not wanted.
      latest.current += 1;
    };
  }, [data, key, revision]);

  return state;
}

/**
 * The `blob:` URL of a book's cover, or `undefined` while it loads or when the book has none.
 * The URL is shared with other users of the same cover and revoked when nobody shows it and the
 * cache needs room, so never store it beyond the component.
 */
export function useCoverUrl(bookId: string, hasCover: boolean): string | undefined {
  const { covers } = useServices();
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!hasCover) {
      setUrl(undefined);
      return undefined;
    }
    let cancelled = false;
    let release: (() => void) | undefined;
    void covers.acquire(bookId).then(
      (lease) => {
        if (!lease) return;
        if (cancelled) lease.release();
        else {
          release = lease.release;
          setUrl(lease.url);
        }
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
      release?.();
      setUrl(undefined);
    };
  }, [covers, bookId, hasCover]);
  return url;
}

/** Book ids that have a cover, as one stable string, so a list that keeps its covers does not re-run effects. */
function coverKey(books: readonly { readonly id: string; readonly coverRef?: unknown }[]): string {
  return books
    .filter((b) => b.coverRef !== undefined)
    .map((b) => b.id)
    .join('\n');
}

/**
 * Cover `blob:` URLs for a whole grid at once (`{ [bookId]: url }`). One lease per book that has a
 * cover is held while the book is in `books` and released when it leaves or the screen unmounts;
 * a cover that is still loading is simply missing from the result (the card shows its title card,
 * so nothing shifts when the image arrives). Re-runs only when the set of books with covers changes.
 */
export function useCoverUrls(books: readonly { readonly id: string; readonly coverRef?: unknown }[]): Readonly<Record<string, string>> {
  const { covers } = useServices();
  const key = coverKey(books);
  const [urls, setUrls] = useState<Readonly<Record<string, string>>>({});
  const leases = useRef(new Map<string, { release: () => void; url: string }>());

  useEffect(() => {
    const wanted = new Set(key === '' ? [] : key.split('\n'));
    const held = leases.current;
    let changed = false;
    for (const [id, lease] of held) {
      if (!wanted.has(id)) {
        lease.release();
        held.delete(id);
        changed = true;
      }
    }
    if (changed) setUrls(Object.fromEntries([...held].map(([id, lease]) => [id, lease.url])));
    let cancelled = false;
    for (const id of wanted) {
      if (held.has(id)) continue;
      void covers.acquire(id).then(
        (lease) => {
          if (!lease) return;
          if (cancelled || !wanted.has(id) || held.has(id)) {
            lease.release();
            return;
          }
          held.set(id, lease);
          setUrls((current) => ({ ...current, [id]: lease.url }));
        },
        () => undefined,
      );
    }
    return () => {
      cancelled = true;
    };
  }, [covers, key]);

  // Release everything when the screen goes away.
  useEffect(() => {
    const held = leases.current;
    return () => {
      for (const lease of held.values()) lease.release();
      held.clear();
    };
  }, []);

  return urls;
}
