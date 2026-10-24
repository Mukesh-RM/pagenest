import { memo, useCallback, useMemo } from 'react';
import type { BookSummary as DataBook } from '@/data/library-query';
import { toCardBook, useSettledCover } from './card-book';
import { BookCard, type BookSummary as CardBook, type RectLike } from '@/ui';

export interface BookItemProps {
  book: DataBook;
  /** `undefined` outside selecting, so the card shows no selection state. */
  selected: boolean | undefined;
  view: 'grid' | 'list';
  /** The first screen of covers load eagerly. */
  eager: boolean;
  onOpen: (book: DataBook, coverRect: RectLike | undefined) => void;
  onSelect: (book: DataBook) => void;
}

/**
 * One book in the grid or list, drawn by the design system's `BookCard` (cover or generated title card,
 * title, author, progress). Memoized: only the cards whose book, progress or selection changed redraw.
 */
export const BookItem = memo(function BookItem({ book, selected, view, eager, onOpen, onSelect }: BookItemProps) {
  const coverUrl = useSettledCover(book);
  const card = useMemo(() => toCardBook(book, coverUrl), [book, coverUrl]);
  const open = useCallback((_: CardBook, rect: RectLike | undefined) => onOpen(book, rect), [onOpen, book]);
  const select = useCallback(() => onSelect(book), [onSelect, book]);
  return <BookCard book={card} layout={view} eager={eager} selected={selected} onOpen={open} onSelect={select} />;
});
