import type { BookSummary } from '@/data/library-query';
import { VirtualList, useLibraryGrid, type RectLike } from '@/ui';
import type { ViewMode } from '../model';
import { BookItem } from './BookItem';

export interface BookListProps {
  books: readonly BookSummary[];
  selection: ReadonlySet<string>;
  selecting: boolean;
  view: ViewMode;
  onOpen: (book: BookSummary, coverRect: RectLike | undefined) => void;
  onSelect: (book: BookSummary) => void;
}

/** Width and height drawn from until the real ones are measured (first paint and tests). */
const FIRST_SIZE = { width: 360, height: 760 } as const;

const keyOf = (book: BookSummary): string => book.id;

/**
 * The grid and the list: the design system's shared `VirtualList`, with the columns and gaps of the
 * design system's own library grid, so a windowed library looks like a plain one. However many books
 * there are, only the rows near the screen are in the page.
 */
export function BookList({ books, selection, selecting, view, onOpen, onSelect }: BookListProps) {
  const grid = useLibraryGrid(view);
  return (
    <VirtualList<BookSummary>
      items={books}
      aria-label="Books"
      className="pn-library__virtual"
      columns={grid.columns}
      gap={grid.spec.gap}
      rowGap={grid.spec.rowGap}
      estimatedRowHeight={view === 'list' ? 88 : 280}
      initialSize={FIRST_SIZE}
      getKey={keyOf}
      renderItem={(book, index) => (
        <BookItem
          book={book}
          selected={selecting ? selection.has(book.id) : undefined}
          view={view}
          eager={index < 6}
          onOpen={onOpen}
          onSelect={onSelect}
        />
      )}
    />
  );
}
