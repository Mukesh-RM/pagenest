import { useId, type ReactNode, type Ref } from 'react';
import { BookCard } from '../components/BookCard';
import { Button } from '../components/Button';
import { Chip, ChipGroup } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { Illustration } from '../components/Illustration';
import { Icon } from '../icons';
import { SkeletonCard, SkeletonGroup } from '../components/Skeleton';
import type { BookSummary } from '../types';
import type { RectLike } from '../utils/flip';

export interface LibraryFilterOption {
  id: string;
  label: string;
}

export const DEFAULT_LIBRARY_FILTERS: readonly LibraryFilterOption[] = [
  { id: 'all', label: 'All' },
  { id: 'reading', label: 'Reading' },
  { id: 'listening', label: 'Listening' },
  { id: 'finished', label: 'Finished' },
];

export interface LibraryScreenProps {
  /** Books to show, already filtered and searched by the data layer. */
  books: readonly BookSummary[];
  /** Skeleton cards instead of the grid. Keep the grid mounted size stable: no layout shift. */
  loading?: boolean;
  /** Plain-word error shown above the grid (see ErrorNotice). */
  notice?: ReactNode;
  /** The quiet "Welcome back" card (ResumeCard) or nothing. */
  resume?: ReactNode;
  /** One gentle hint (GestureHint) or nothing. */
  hint?: ReactNode;
  filters?: readonly LibraryFilterOption[];
  filter: string;
  onFilterChange: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Ref of the search field, for the "/" shortcut. */
  searchRef?: Ref<HTMLInputElement>;
  onOpenBook: (book: BookSummary, coverRect: RectLike | undefined) => void;
  onSelectBook?: (book: BookSummary) => void;
  selectedIds?: readonly string[];
  onAdd: () => void;
  /** Number of skeleton cards while loading. */
  skeletonCount?: number;
}

/**
 * Library screen (blueprint 5.1): header with Add, search, filter chips, an auto-fill grid of cover cards that
 * runs from 2 columns on a phone to 8 on a wide laptop. Presentational: the app passes filtered data and handlers.
 */
export function LibraryScreen({
  books,
  loading = false,
  notice,
  resume,
  hint,
  filters = DEFAULT_LIBRARY_FILTERS,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  searchRef,
  onOpenBook,
  onSelectBook,
  selectedIds = [],
  onAdd,
  skeletonCount = 8,
}: LibraryScreenProps) {
  const searchId = useId();
  const empty = !loading && books.length === 0;
  const emptyKind = query ? 'search' : filter !== 'all' ? 'filter' : 'library';
  return (
    <div className="pn-screen pn-library">
      <header className="pn-screen__header">
        <h1 className="pn-screen__title">Library</h1>
        <Button icon="plus" onClick={onAdd}>
          Add books
        </Button>
      </header>

      <div className="pn-library__tools">
        <div className="pn-search">
          <label htmlFor={searchId} className="pn-visually-hidden">
            Search your library
          </label>
          <span className="pn-search__icon" aria-hidden="true">
            <Icon name="search" size={20} />
          </span>
          <input
            id={searchId}
            ref={searchRef}
            type="search"
            className="pn-search__input"
            placeholder="Search titles and authors"
            value={query}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <ChipGroup label="Filter library" scroll>
          {filters.map((f) => (
            <Chip key={f.id} selected={filter === f.id} onClick={() => onFilterChange(f.id)}>
              {f.label}
            </Chip>
          ))}
        </ChipGroup>
      </div>

      {notice}
      {resume}
      {hint}

      {loading ? (
        <SkeletonGroup label="Loading your library" className="pn-library__grid">
          {Array.from({ length: skeletonCount }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </SkeletonGroup>
      ) : empty ? (
        <EmptyState
          art={<Illustration name={emptyKind === 'library' ? 'books' : 'search'} />}
          title={emptyKind === 'library' ? 'Your library is empty' : emptyKind === 'search' ? 'No books match that search' : 'Nothing on this shelf yet'}
          description={
            emptyKind === 'library'
              ? 'Add an EPUB, PDF or audiobook from your device. Everything stays on this device.'
              : 'Try a different word, or clear the filter.'
          }
          action={emptyKind === 'library' ? { label: 'Add books', icon: 'plus', onClick: onAdd } : undefined}
        />
      ) : (
        <ul className="pn-library__grid" aria-label="Books">
          {books.map((book, index) => (
            <li key={book.id} className="pn-library__item">
              <BookCard
                book={book}
                eager={index < 6}
                selected={selectedIds.length ? selectedIds.includes(book.id) : undefined}
                onOpen={onOpenBook}
                onSelect={onSelectBook}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
