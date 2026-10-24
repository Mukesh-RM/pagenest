import '../library.css';
import '@/ui/styles/screens.css';
import '@/ui/styles/surfaces.css';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/app/components/PageHeader';
import { SampleBookCard } from '@/app/components/SampleBookCard';
import { useCoverUrl } from '@/app/library-hooks';
import { pathForBook } from '@/app/route-paths';
import { useServices } from '@/app/services-context';
import type { BookSummary, LibraryQuery } from '@/data/library-query';
import { getSetting, setSetting } from '@/data/settings';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Illustration,
  SkeletonCard,
  SkeletonGroup,
  SnackbarProvider,
  useSnackbar,
  type BookDetail,
  type RectLike,
  type SheetCloseReason,
} from '@/ui';
import { ImportProvider } from '../context';
import type { ImportItem } from '@/workers/import/protocol';
import { PREFS_KEY } from '../prefs';
import { DEFAULT_PREFS, formatTag, parsePrefs, toLibraryQuery, type FilterId, type LibraryPrefs, type SortKey, type ViewMode } from '../model';
import { createSampleBookProvider } from '../sample';
import { getImportController } from '../registry';
import { useLibraryItems } from '../use-library-items';
import { AddSheet } from './AddSheet';
import { toCardBook } from './card-book';
import { BookList } from './BookList';
import { BookSheet } from './BookSheet';
import { DropOverlay } from './DropOverlay';
import { ImportStatus } from './ImportStatus';
import { SelectionBar } from './SelectionBar';
import { ShelfSheet } from './ShelfSheet';
import { Toolbar } from './Toolbar';

/** The design system's book detail sheet loads when the first book is tapped, not with the list. */
const BookDetailSheet = lazy(() => import('@/ui/screens/BookDetailSheet'));

const SKELETON_CARDS = 8;

function SkeletonGrid({ view }: { view: ViewMode }) {
  return (
    <SkeletonGroup label="Loading your library" className={view === 'list' ? 'pn-library__grid pn-library__grid--list' : 'pn-library__grid'}>
      {Array.from({ length: SKELETON_CARDS }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </SkeletonGroup>
  );
}

interface Detail {
  book: BookSummary;
  rect: RectLike | undefined;
  open: boolean;
}

/** The design system's book sheet for the tapped book: Read or Listen, progress, and Remove in the ⋯ menu. */
function DetailHost({ detail, onClose, onOpenBook, onRemove }: { detail: Detail; onClose: (reason: SheetCloseReason) => void; onOpenBook: (book: BookSummary) => void; onRemove: (book: BookSummary) => void }) {
  const { book } = detail;
  const coverUrl = useCoverUrl(book.id, book.coverRef !== undefined);
  const shown = useMemo<BookDetail>(
    () => ({
      ...toCardBook(book, coverUrl),
      format: formatTag(book),
      ...(book.narrator ? { narrator: book.narrator } : {}),
      ...(book.pages ? { pages: book.pages } : {}),
      ...(book.durationSec ? { durationSeconds: book.durationSec } : {}),
    }),
    [book, coverUrl],
  );
  const listen = book.kind === 'audio';
  return (
    <BookDetailSheet
      open={detail.open}
      book={shown}
      onClose={onClose}
      {...(detail.rect ? { originRect: detail.rect } : {})}
      {...(listen ? { onListen: () => onOpenBook(book) } : { onRead: () => onOpenBook(book) })}
      onRemove={() => onRemove(book)}
    />
  );
}

export interface LibraryViewProps {
  /** Only books on this shelf. */
  shelfId?: string | undefined;
  /** Screen title. Defaults to "Library". */
  title?: string;
  /** Shows a Back button (used when a shelf or smart shelf is opened from Collections). */
  onBack?: () => void;
  /** Fixed parts of the query (a smart shelf). Overrides the person's sort and filters. */
  preset?: Partial<LibraryQuery>;
  /**
   * Slot under the title, search and filters and above the books: the app puts the "Welcome back" resume
   * card here (the design system's place for it). It scrolls with the page, like the books.
   */
  header?: ReactNode;
}

function LibraryBody({ shelfId, title = 'Library', onBack, preset, header }: LibraryViewProps) {
  const { db, data, sampleBook } = useServices();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const controller = getImportController();
  const [params, setParams] = useSearchParams();

  const [prefs, setPrefsState] = useState<LibraryPrefs>(DEFAULT_PREFS);
  const [prefsReady, setPrefsReady] = useState(false);
  useEffect(() => {
    let live = true;
    void getSetting<unknown>(db, PREFS_KEY).then(
      (saved) => {
        if (!live) return;
        setPrefsState(parsePrefs(saved));
        setPrefsReady(true);
      },
      () => live && setPrefsReady(true),
    );
    return () => {
      live = false;
    };
  }, [db]);
  const setPrefs = useCallback(
    (patch: Partial<LibraryPrefs>) => {
      setPrefsState((p) => {
        const next = { ...p, ...patch };
        void setSetting(db, PREFS_KEY, next).catch(() => undefined);
        return next;
      });
    },
    [db],
  );

  const [text, setText] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const query = useMemo(
    () => ({ ...toLibraryQuery({ text, filter, sort: prefs.sort, collectionId: shelfId }), ...(preset ?? {}) }),
    [text, filter, prefs.sort, shelfId, preset],
  );
  const { items, total, libraryCount, ready, error, patch, remove, reload } = useLibraryItems(query);

  // Refresh at once when an import adds books (the database change also arrives, a moment later).
  const [bump, setBump] = useState(0);
  useEffect(() => controller.onBooksChanged(() => setBump((n) => n + 1)), [controller]);
  useEffect(() => {
    if (bump > 0) reload();
  }, [bump, reload]);

  // ----- selection (press and hold a book, or the context-menu key) -----
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const selecting = selection.size > 0;
  const [selectMode, setSelectMode] = useState(false);
  const selectingNow = selecting || selectMode;
  const toggle = useCallback((id: string) => {
    setSelectMode(true);
    setSelection((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  const endSelect = useCallback(() => {
    setSelectMode(false);
    setSelection(new Set());
  }, []);

  // ----- opening a book: the detail sheet, then Read or Listen -----
  const [detail, setDetail] = useState<Detail | undefined>();
  const onOpenBook = useCallback(
    (book: BookSummary, rect: RectLike | undefined) => {
      if (selectingNow) toggle(book.id);
      else setDetail({ book, rect, open: true });
    },
    [selectingNow, toggle],
  );
  const closeDetail = useCallback((_reason: SheetCloseReason) => setDetail((d) => (d ? { ...d, open: false } : d)), []);
  const goToBook = useCallback(
    (book: BookSummary) => {
      setDetail(undefined);
      navigate(pathForBook(book));
    },
    [navigate],
  );

  // ----- importing -----
  const [adding, setAdding] = useState(false);
  const startImport = useCallback(
    (picked: ImportItem[]) => {
      void controller.importFiles(picked);
    },
    [controller],
  );
  const share = params.get('share');
  useEffect(() => {
    if (share === null) return;
    void controller.importShared().then(() => {
      const next = new URLSearchParams(params);
      next.delete('share');
      setParams(next, { replace: true });
    });
    // `params` is read once per change of `share`, on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [share, controller]);

  // ----- actions on the selection -----
  const chosen = useMemo(() => items.filter((b) => selection.has(b.id)), [items, selection]);
  const [editing, setEditing] = useState<BookSummary | undefined>();
  const [shelfPick, setShelfPick] = useState(false);
  const say = useCallback((message: string) => snackbar.show({ message }), [snackbar]);

  const writeFlags = useCallback(
    async (books: readonly BookSummary[], change: { favorite?: boolean; finished?: boolean }) => {
      for (const b of books) patch(b.id, change);
      try {
        await Promise.all(books.map((b) => data.books.update(b.id, change)));
      } catch {
        reload();
        say('That change could not be saved. Please try again.');
      }
    },
    [data, patch, reload, say],
  );
  const favoriteSelected = (): void => void writeFlags(chosen, { favorite: !chosen.every((b) => b.favorite) });
  const finishedSelected = (): void => void writeFlags(chosen, { finished: !chosen.every((b) => b.finished) });

  /** Removes books from the library with an Undo, for the selection bar and for the detail sheet. */
  const removeBooks = useCallback(
    async (ids: string[]): Promise<void> => {
      if (ids.length === 0) return;
      remove(ids);
      try {
        const receipt = await data.books.trash(ids);
        snackbar.show({
          message: ids.length === 1 ? 'Book removed' : `${ids.length} books removed`,
          onAction: () => {
            void data.books.restore(receipt.token).then(reload, () => say('That could not be undone. Add the book again from its file.'));
          },
          onDismiss: (reason) => {
            if (reason !== 'action') void data.books.purge(receipt.token).catch(() => undefined);
          },
        });
      } catch {
        reload();
        say('Those books could not be removed. Please try again.');
      }
    },
    [data, remove, reload, snackbar, say],
  );
  const deleteSelected = (): void => {
    const ids = chosen.map((b) => b.id);
    endSelect();
    void removeBooks(ids);
  };

  const [removing, setRemoving] = useState<BookSummary | undefined>();
  const askRemove = useCallback((book: BookSummary) => {
    setDetail(undefined);
    setRemoving(book);
  }, []);

  const saveDetails = useCallback(
    async (id: string, details: { title: string; author: string }): Promise<string | undefined> => {
      const title = details.title.trim().replace(/\s+/g, ' ');
      if (title === '') return 'A book needs a title.';
      patch(id, { title, ...(details.author.trim() ? { author: details.author.trim() } : {}) });
      try {
        await data.books.update(id, { title, author: details.author.trim() === '' ? null : details.author.trim() });
        return undefined;
      } catch {
        reload();
        return 'That change could not be saved. Please try again.';
      }
    },
    [data, patch, reload],
  );

  const provider = useMemo(() => sampleBook ?? createSampleBookProvider(), [sampleBook]);
  const filtered = text.trim() !== '' || filter !== 'all';
  const showEmptyLibrary = ready && libraryCount === 0 && !shelfId && !preset;

  return (
    <>
      <PageHeader title={title}>
        {onBack ? (
          <span className="pn-lib-headactions">
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
            <Button icon="plus" onClick={() => setAdding(true)}>
              Add books
            </Button>
          </span>
        ) : (
          <Button icon="plus" onClick={() => setAdding(true)}>
            Add books
          </Button>
        )}
      </PageHeader>
      <Toolbar
        text={text}
        onText={setText}
        filter={filter}
        onFilter={setFilter}
        sort={prefs.sort}
        onSort={(sort: SortKey) => setPrefs({ sort })}
        view={prefs.view}
        onView={(view: ViewMode) => setPrefs({ view })}
        showSort={text.trim() === ''}
      />
      {header}
      <div className="pn-visually-hidden" role="status">
        {ready && !showEmptyLibrary ? `${total} ${total === 1 ? 'book' : 'books'}` : ''}
      </div>

      {!ready || !prefsReady ? (
        <SkeletonGrid view={prefs.view} />
      ) : error && items.length === 0 ? (
        <EmptyState
          art={<Illustration name="offline" />}
          title="Your library could not be read"
          description="Close other PageNest tabs and try again."
          action={{ label: 'Try again', onClick: reload }}
        />
      ) : showEmptyLibrary ? (
        <EmptyState
          art={<Illustration name="books" />}
          title="Your library is empty"
          description="Add an EPUB, PDF or audiobook from your device. Everything stays on this device."
          action={{ label: 'Add books', icon: 'plus', onClick: () => setAdding(true) }}
          extra={
            provider.available() ? (
              <SampleBookCard provider={provider} onImported={(r) => navigate(pathForBook({ id: r.bookId, kind: r.kind }))} />
            ) : undefined
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          art={<Illustration name={shelfId || preset ? 'shelf' : 'search'} />}
          title={shelfId || preset ? 'Nothing here yet' : text.trim() ? 'No books match that search' : 'Nothing on this shelf yet'}
          description={shelfId ? 'Press and hold a book in your library and choose Add to a collection.' : 'Try a different word, or clear the filter.'}
          {...(filtered
            ? {
                action: {
                  label: 'Clear search and filters',
                  onClick: () => {
                    setText('');
                    setFilter('all');
                  },
                },
              }
            : {})}
        />
      ) : (
        <BookList books={items} selection={selection} selecting={selectingNow} view={prefs.view} onOpen={onOpenBook} onSelect={(book) => toggle(book.id)} />
      )}

      <div className="pn-lib-dock">
        <ImportStatus />
        {selectingNow ? (
          <SelectionBar
            count={selection.size}
            total={items.length}
            allFavorite={chosen.length > 0 && chosen.every((b) => b.favorite)}
            onFavorite={favoriteSelected}
            onFinished={finishedSelected}
            onShelf={() => setShelfPick(true)}
            onDetails={chosen.length === 1 ? () => setEditing(chosen[0]) : undefined}
            onDelete={deleteSelected}
            onSelectAll={() => setSelection(new Set(items.map((b) => b.id)))}
            onDone={endSelect}
          />
        ) : null}
      </div>

      {detail ? (
        <Suspense fallback={null}>
          <DetailHost detail={detail} onClose={closeDetail} onOpenBook={goToBook} onRemove={askRemove} />
        </Suspense>
      ) : null}
      <ConfirmDialog
        open={removing !== undefined}
        title={removing ? `Remove \u201c${removing.title}\u201d?` : 'Remove this book?'}
        description="It leaves your library and this device. You can undo for a few seconds."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          const book = removing;
          setRemoving(undefined);
          if (book) void removeBooks([book.id]);
        }}
        onCancel={() => setRemoving(undefined)}
      />
      <AddSheet open={adding} onClose={() => setAdding(false)} onPick={startImport} />
      <BookSheet book={editing} onClose={() => setEditing(undefined)} onSave={saveDetails} />
      <ShelfSheet open={shelfPick} bookIds={chosen.map((b) => b.id)} onClose={() => setShelfPick(false)} onDone={(m) => (say(m), endSelect())} />
      <DropOverlay onDrop={startImport} />
    </>
  );
}

/** The Library screen: search, filters, grid or list of every book, importing, selecting and organizing. */
export function LibraryScreen(props: LibraryViewProps = {}) {
  return (
    <SnackbarProvider>
      <ImportProvider controller={getImportController()}>
        <LibraryBody {...props} />
      </ImportProvider>
    </SnackbarProvider>
  );
}
