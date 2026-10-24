import { useRef } from 'react';
import type { BookSummary } from '@/data/library-query';
import type { RectLike } from '@/ui';
import type { ViewMode } from '../model';
import { useGridWindow } from '../virtual';
import { BookItem } from './BookItem';

export interface BookListProps {
  books: readonly BookSummary[];
  selection: ReadonlySet<string>;
  selecting: boolean;
  view: ViewMode;
  onOpen: (book: BookSummary, coverRect: RectLike | undefined) => void;
  onSelect: (book: BookSummary) => void;
}

/**
 * The grid and the list, in the design system's own layout (`pn-library__grid`). Both are windowed
 * against the page scroll: however many books there are, only the rows near the screen are in the
 * page, and padding stands in for the rest.
 */
export function BookList({ books, selection, selecting, view, onOpen, onSelect }: BookListProps) {
  const ref = useRef<HTMLUListElement>(null);
  const { start, end, padTop, padBottom } = useGridWindow(ref, books.length, view);
  const drawn = books.slice(start, end);
  return (
    <ul
      ref={ref}
      className={view === 'list' ? 'pn-library__grid pn-library__grid--list' : 'pn-library__grid'}
      aria-label="Books"
      style={{ paddingTop: padTop, paddingBottom: padBottom, overflowAnchor: 'none' }}
    >
      {drawn.map((book, i) => (
        <li key={book.id} className="pn-library__item" aria-setsize={books.length} aria-posinset={start + i + 1}>
          <BookItem
            book={book}
            selected={selecting ? selection.has(book.id) : undefined}
            view={view}
            eager={start + i < 6}
            onOpen={onOpen}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
