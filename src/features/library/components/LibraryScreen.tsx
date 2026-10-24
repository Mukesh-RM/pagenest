import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/app/components/PageHeader';
import { SampleBookCard } from '@/app/components/SampleBookCard';
import { pathForBook } from '@/app/route-paths';
import { useServices } from '@/app/services-context';
import type { BookSummary, LibraryQuery } from '@/data/library-query';
import { getSetting, setSetting } from '@/data/settings';
import { Button, EmptyState, SkeletonGroup, SnackbarProvider, useSnackbar } from '@/ui';
import { ImportProvider } from '../context';
import type { ImportItem } from '@/workers/import/protocol';
import { PREFS_KEY } from '../prefs';
import { DEFAULT_PREFS, parsePrefs, toLibraryQuery, type FilterChip, type LibraryPrefs, type Segment, type SortKey, type ViewMode } from '../model';
import { createSampleBookProvider } from '../sample';
import { getImportController } from '../registry';
import { useLibraryItems } from '../use-library-items';
import { AddSheet } from './AddSheet';
import { BookList } from './BookList';
import { BookSheet } from './BookSheet';
import { DropOverlay } from './DropOverlay';
import { ImportStatus } from './ImportStatus';
import { SelectionBar } from './SelectionBar';
import { ShelfSheet } from './ShelfSheet';
import { Toolbar } from './Toolbar';

/** Default measurements until the real ones are read from a hidden sample (also used in tests). */
const DEFAULT_META = 76;
const DEFAULT_ROW = 80;

function useMeasured(ref: React.RefObject<HTMLElement | null>, fallback: number): number {
  const [h, setH] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = (): void => {
      const next = Math.ceil(el.getBoundingClientRect().height);
      if (next > 0) setH(next);
    };
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return h;
}

function SkeletonGrid() {
  return (
    <SkeletonGroup label="Loading your library" className="pn-lib-skeleton">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="pn-lib-skeleton__card">
          <span className="pn-skeleton pn-lib-skeleton__cover" aria-hidden="true" />
          <span className="pn-skeleton pn-skeleton--text pn-lib-skeleton__line" aria-hidden="true" />
        </div>
      ))}
    </SkeletonGroup>
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
}

function LibraryBody({ shelfId, title = 'Library', onBack, preset }: LibraryViewProps) {
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
  const [chip, setChip] = useState<FilterChip | null>(null);
  const query = useMemo(
    () => ({ ...toLibraryQuery({ text, segment: prefs.segment, chip, sort: prefs.sort, collectionId: shelfId }), ...(preset ?? {}) }),
    [text, prefs.segment, chip, prefs.sort, shelfId, preset],
  );
  const { items, total, libraryCount, ready, error, patch, remove, reload } = useLibraryItems(query);

  // Refresh at once when an import adds books (the database change also arrives, a moment later).
  const [bump, setBump] = useState(0);
  useEffect(() => controller.onBooksChanged(() => setBump((n) => n + 1)), [controller]);
  useEffect(() => {
    if (bump > 0) reload();
  }, [bump, reload]);

  // ----- selection -----
  const [selectMode, setSelectMode] = useState(false);
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const selecting = selectMode || selection.size > 0;
  const toggle = useCallback((id: string) => {
    setSelection((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  const startSelect = useCallback((id: string) => {
    setSelectMode(true);
    setSelection((s) => new Set(s).add(id));
  }, []);
  const endSelect = useCallback(() => {
    setSelectMode(false);
    setSelection(new Set());
  }, []);
  const open = useCallback((book: BookSummary) => navigate(pathForBook(book)), [navigate]);

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

  const deleteSelected = async (): Promise<void> => {
    const ids = chosen.map((b) => b.id);
    if (ids.length === 0) return;
    remove(ids);
    endSelect();
    try {
      const receipt = await data.books.trash(ids);
      snackbar.show({
        message: ids.length === 1 ? 'Book deleted' : `${ids.length} books deleted`,
        onAction: () => {
          void data.books.restore(receipt.token).then(reload, () => say('That could not be undone. Add the book again from its file.'));
        },
        onDismiss: (reason) => {
          if (reason !== 'action') void data.books.purge(receipt.token).catch(() => undefined);
        },
      });
    } catch {
      reload();
      say('Those books could not be deleted. Please try again.');
    }
  };

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

  // ----- measurements for the virtual list -----
  const metaProbe = useRef<HTMLDivElement>(null);
  const rowProbe = useRef<HTMLDivElement>(null);
  const metaHeight = useMeasured(metaProbe, DEFAULT_META);
  const rowHeight = useMeasured(rowProbe, DEFAULT_ROW);

  const provider = useMemo(() => sampleBook ?? createSampleBookProvider(), [sampleBook]);
  const filtered = text.trim() !== '' || chip !== null || prefs.segment !== 'all';
  const showEmptyLibrary = ready && libraryCount === 0 && !shelfId && !preset;

  return (
    <>
      <PageHeader title={title}>
        <span className="pn-lib-headactions">
          {onBack ? (
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
          ) : null}
          <Button icon="plus" onClick={() => setAdding(true)}>
            Add
          </Button>
        </span>
      </PageHeader>
      <Toolbar
        text={text}
        onText={setText}
        view={prefs.view}
        onView={(view: ViewMode) => setPrefs({ view })}
        sort={prefs.sort}
        onSort={(sort: SortKey) => setPrefs({ sort })}
        segment={prefs.segment}
        onSegment={(segment: Segment) => setPrefs({ segment })}
        chip={chip}
        onChip={setChip}
        selectMode={selecting}
        onSelectMode={() => (selecting ? endSelect() : setSelectMode(true))}
        showSort={text.trim() === ''}
      />
      <div className="pn-visually-hidden" role="status">
        {ready && !showEmptyLibrary ? `${total} ${total === 1 ? 'book' : 'books'}` : ''}
      </div>
      <div className="pn-lib-probes" aria-hidden="true" {...{ inert: '' }}>
        <span ref={metaProbe} className="pn-lib-meta pn-lib-probe">
          <span className="pn-lib-title">Title</span>
          <span className="pn-lib-author">Author</span>
        </span>
        <span ref={rowProbe} className="pn-lib-rowprobe">
          <span className="pn-lib-cover pn-lib-rowprobe__cover" />
          <span className="pn-lib-rowmeta">
            <span className="pn-lib-title">Title</span>
            <span className="pn-lib-author">Author</span>
            <span className="pn-lib-sub">EPUB</span>
          </span>
        </span>
      </div>

      {!ready || !prefsReady ? (
        <SkeletonGrid />
      ) : error && items.length === 0 ? (
        <EmptyState art="alert" title="Your library could not be read" description="Close other PageNest tabs and try again." action={{ label: 'Try again', onClick: reload }} />
      ) : showEmptyLibrary ? (
        <>
          <EmptyState
            art="bookOpen"
            title="Your shelf is waiting"
            description="Add books, PDFs or audiobooks and they appear here. Everything stays on this device."
            action={{ label: 'Add files', icon: 'plus', onClick: () => setAdding(true) }}
          />
          {provider.available() ? (
            <SampleBookCard provider={provider} onImported={(r) => navigate(pathForBook({ id: r.bookId, kind: r.kind }))} />
          ) : null}
        </>
      ) : items.length === 0 ? (
        <EmptyState
          art="search"
          title={shelfId || preset ? 'Nothing here yet' : 'No books match'}
          description={shelfId ? 'Press and hold a book in your library and choose Add to a collection.' : 'Try different words, or clear the filters.'}
          {...(filtered
            ? {
                action: {
                  label: 'Clear search and filters',
                  onClick: () => {
                    setText('');
                    setChip(null);
                    setPrefs({ segment: 'all' });
                  },
                },
              }
            : {})}
        />
      ) : (
        <BookList
          books={items}
          selection={selection}
          selecting={selecting}
          view={prefs.view}
          metaHeight={metaHeight}
          rowHeight={rowHeight}
          onOpen={open}
          onToggle={toggle}
          onSelectStart={startSelect}
        />
      )}

      <div className="pn-lib-dock">
        <ImportStatus />
        {selecting ? (
          <SelectionBar
            count={selection.size}
            total={items.length}
            allFavorite={chosen.length > 0 && chosen.every((b) => b.favorite)}
            onFavorite={favoriteSelected}
            onFinished={finishedSelected}
            onShelf={() => setShelfPick(true)}
            onDetails={chosen.length === 1 ? () => setEditing(chosen[0]) : undefined}
            onDelete={() => void deleteSelected()}
            onSelectAll={() => setSelection(new Set(items.map((b) => b.id)))}
            onDone={endSelect}
          />
        ) : null}
      </div>

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
