import { useEffect, useState } from 'react';
import { useCoverUrl } from '@/app/library-hooks';
import type { BookSummary as DataBook } from '@/data/library-query';
import type { BookSummary as CardBook } from '@/ui';

const COVER_DELAY_MS = 90;

/** A cover is asked for only after its card stayed on screen a moment, so a fast scroll decodes nothing. */
export function useSettledCover(book: Pick<DataBook, 'id' | 'coverRef'>): string | undefined {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), COVER_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return useCoverUrl(book.id, settled && book.coverRef !== undefined);
}

/** What the design system's card draws for one book of the library. */
export function toCardBook(book: DataBook, coverUrl: string | undefined): CardBook {
  return {
    id: book.id,
    title: book.title,
    ...(book.author ? { author: book.author } : {}),
    ...(coverUrl ? { coverUrl } : {}),
    progress: book.finished ? 1 : Math.max(0, Math.min(100, book.percent)) / 100,
    audio: book.kind === 'audio',
  };
}

