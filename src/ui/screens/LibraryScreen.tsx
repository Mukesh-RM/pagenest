import { useId, type ReactNode, type Ref } from 'react';
import { BookCard } from '../components/BookCard';
import { Button } from '../components/Button';
import { Chip, ChipGroup } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { FirstRunBooks } from '../components/FirstRunBooks';
import { Illustration } from '../components/Illustration';
import type { StarterBookOffer } from '../components/StarterBookCard';
import { Icon } from '../icons';
import { SkeletonCard, SkeletonGroup } from '../components/Skeleton';
import type { BookSummary } from '../types';
import { DEFAULT_LIBRARY_FILTERS, DEFAULT_LIBRARY_SORTS, type LibraryFilterOption, type LibrarySortOption } from './libraryOptions';

export type { LibraryFilterOption, LibrarySortOption };
import { cx } from '../utils/cx';
import type { RectLike } from '../utils/flip';
import '../styles/screens.css';
import '../styles/surfaces.css';


export type LibraryView = 'grid' | 'list';


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
  /** Opens the file picker. Optional: without it there is no Add button anywhere on the screen. */
  onAdd?: () => void;
  /** An extra action in the empty state, next to (or instead of) Add, for example "Open a sample book". */
  emptyActions?: ReactNode;
  /** Number of skeleton cards while loading. */
  skeletonCount?: number;
  /** Sort order id. The data layer sorts; this screen only shows the control. Leave out to hide the control. */
  sort?: string;
  sorts?: readonly LibrarySortOption[];
  onSortChange?: (id: string) => void;
  /** Grid of covers or a compact list. Leave `onViewChange` out to hide the switch. */
  view?: LibraryView;
  onViewChange?: (view: LibraryView) => void;
  /** A real bundled public-domain book for the first-run path. Leave out when the app has none. */
  starter?: StarterBookOffer;
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
  emptyActions,
  skeletonCount = 8,
  sort,
  sorts = DEFAULT_LIBRARY_SORTS,
  onSortChange,
  view = 'grid',
  onViewChange,
  starter,
}: LibraryScreenProps) {
  const searchId = useId();
  const sortId = useId();
  const empty = !loading && books.length === 0;
  const emptyKind = query ? 'search' : filter !== 'all' ? 'filter' : 'library';
  return (
    <div className="pn-screen pn-library">
      <header className="pn-screen__header">
        <h1 className="pn-screen__title">Library</h1>
        {onAdd ? (
          <Button icon="plus" onClick={onAdd}>
            Add books
          </Button>
        ) : null}
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
            placeholder="Search books"
            value={query}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <div className="pn-library__filters">
          <ChipGroup label="Filter library" scroll>
            {filters.map((f) => (
              <Chip key={f.id} selected={filter === f.id} onClick={() => onFilterChange(f.id)}>
                {f.label}
              </Chip>
            ))}
          </ChipGroup>
        </div>
        {sort !== undefined && onSortChange || onViewChange ? (
          <div className="pn-library__options">
            {sort !== undefined && onSortChange ? (
              <div className="pn-sort">
                <label htmlFor={sortId} className="pn-sort__label">
                  Sort by
                </label>
                <span className="pn-sort__field">
                  <select id={sortId} className="pn-sort__select" value={sort} onChange={(event) => onSortChange(event.target.value)}>
                    {sorts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <span className="pn-sort__chevron" aria-hidden="true">
                    <Icon name="chevronDown" size={18} />
                  </span>
                </span>
              </div>
            ) : (
              <span />
            )}
            {onViewChange ? (
              <div role="group" aria-label="Library layout" className="pn-viewswitch">
                <button type="button" className="pn-viewswitch__btn" aria-pressed={view === 'grid'} aria-label="Grid of covers" onClick={() => onViewChange('grid')}>
                  <Icon name="layoutGrid" size={20} />
                </button>
                <button type="button" className="pn-viewswitch__btn" aria-pressed={view === 'list'} aria-label="List" onClick={() => onViewChange('list')}>
                  <Icon name="list" size={20} />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {notice}
      {resume}
      {hint}

      {loading ? (
        <SkeletonGroup label="Loading your library" className={cx('pn-library__grid', view === 'list' && 'pn-library__grid--list')}>
          {Array.from({ length: skeletonCount }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </SkeletonGroup>
      ) : empty && emptyKind === 'library' && starter ? (
        <FirstRunBooks onAdd={onAdd} starter={starter} extra={emptyActions} />
      ) : empty ? (
        <EmptyState
          art={<Illustration name={emptyKind === 'library' ? 'books' : 'search'} />}
          title={emptyKind === 'library' ? 'Your library is empty' : emptyKind === 'search' ? 'No books match that search' : 'Nothing on this shelf yet'}
          description={
            emptyKind === 'library'
              ? 'Add an EPUB, PDF or audiobook from your device. Everything stays on this device.'
              : 'Try a different word, or clear the filter.'
          }
          action={emptyKind === 'library' && onAdd ? { label: 'Add books', icon: 'plus', onClick: onAdd } : undefined}
          extra={emptyKind === 'library' ? emptyActions : undefined}
        />
      ) : (
        <ul className={cx('pn-library__grid', view === 'list' && 'pn-library__grid--list')} aria-label="Books">
          {books.map((book, index) => (
            <li key={book.id} className="pn-library__item">
              <BookCard
                book={book}
                eager={index < 6}
                layout={view}
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

export default LibraryScreen;
