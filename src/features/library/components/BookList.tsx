import { useRef } from 'react';
import type { BookSummary } from '@/data/library-query';
import { useWindowVirtual } from '../virtual';
import type { ViewMode } from '../model';
import { BookItem } from './BookItem';

export interface BookListProps {
  books: readonly BookSummary[];
  selection: ReadonlySet<string>;
  selecting: boolean;
  view: ViewMode;
  metaHeight: number;
  rowHeight: number;
  onOpen: (book: BookSummary) => void;
  onToggle: (id: string) => void;
  onSelectStart: (id: string) => void;
}

/**
 * The grid and the list. Both are virtualized against the page scroll: however many books there
 * are, only the rows near the screen are in the page, and each is placed with a transform.
 */
export function BookList({ books, selection, selecting, view, metaHeight, rowHeight, onOpen, onToggle, onSelectStart }: BookListProps) {
  const ref = useRef<HTMLUListElement>(null);
  const { layout, boxes } = useWindowVirtual(ref, { count: books.length, mode: view, metaHeight, rowHeight });
  return (
    <ul ref={ref} role="list" className="pn-lib-list" aria-label="Your library" style={{ height: layout.totalHeight }}>
      {boxes.map((box) => {
        const book = books[box.index];
        if (!book) return null;
        return (
          <li
            key={book.id}
            className="pn-lib-item"
            aria-setsize={books.length}
            aria-posinset={box.index + 1}
            style={{ width: layout.itemWidth, height: layout.itemHeight, transform: `translate3d(${box.x}px, ${box.y}px, 0)` }}
          >
            <BookItem
              book={book}
              selected={selection.has(book.id)}
              selecting={selecting}
              view={view}
              onOpen={onOpen}
              onToggle={onToggle}
              onSelectStart={onSelectStart}
            />
          </li>
        );
      })}
    </ul>
  );
}
