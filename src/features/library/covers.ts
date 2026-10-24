import { useEffect, useState } from 'react';
import type { FileStore } from '@/data/opfs';
import type { StoredBook } from '@/workers/import/protocol';
import { coverVersion } from './controller';

/**
 * Cover pictures as object URLs, shared between cards and revoked a while after the last card that
 * used them is gone. A card asks for its cover only after it has stayed on screen for a moment, so a
 * fast scroll through thousands of books never decodes a picture nobody saw.
 */
const REVOKE_AFTER_MS = 15_000;
const SHOW_DELAY_MS = 90;

interface Entry {
  url: string | undefined;
  refs: number;
  timer: ReturnType<typeof setTimeout> | undefined;
  pending: Promise<string | undefined> | undefined;
}
const cache = new Map<string, Entry>();

async function acquire(key: string, load: () => Promise<Blob | undefined>): Promise<string | undefined> {
  let entry = cache.get(key);
  if (!entry) {
    entry = { url: undefined, refs: 0, timer: undefined, pending: undefined };
    cache.set(key, entry);
  }
  entry.refs += 1;
  clearTimeout(entry.timer);
  entry.timer = undefined;
  if (entry.url) return entry.url;
  const e = entry;
  e.pending ??= load()
    .then((blob) => {
      e.url = blob ? URL.createObjectURL(blob) : undefined;
      return e.url;
    })
    .catch(() => undefined);
  return e.pending;
}

function release(key: string): void {
  const entry = cache.get(key);
  if (!entry) return;
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0) return;
  entry.timer = setTimeout(() => {
    if (entry.url) URL.revokeObjectURL(entry.url);
    cache.delete(key);
  }, REVOKE_AFTER_MS);
}

/** Drop every cached picture now (tests, and when the library is torn down). */
export function clearCoverCache(): void {
  for (const entry of cache.values()) {
    clearTimeout(entry.timer);
    if (entry.url) URL.revokeObjectURL(entry.url);
  }
  cache.clear();
}

/** The cover's URL, or `undefined` while it loads or when the book has no cover (show a title card then). */
export function useCoverUrl(book: Pick<StoredBook, 'id' | 'coverRef'>, getFiles: () => Promise<FileStore>): string | undefined {
  const ref = book.coverRef;
  const key = ref ? `${book.id}:${coverVersion.get(book.id) ?? 0}:${ref}` : undefined;
  const [url, setUrl] = useState<string | undefined>(() => (key ? cache.get(key)?.url : undefined));
  useEffect(() => {
    if (!key || !ref) {
      setUrl(undefined);
      return undefined;
    }
    let live = true;
    let held = false;
    const timer = setTimeout(
      () => {
        held = true;
        void acquire(key, async () => (await getFiles()).open(ref)).then((u) => {
          if (live) setUrl(u);
        });
      },
      cache.get(key)?.url ? 0 : SHOW_DELAY_MS,
    );
    return () => {
      live = false;
      clearTimeout(timer);
      if (held) release(key);
    };
  }, [key, ref, getFiles]);
  return url;
}
