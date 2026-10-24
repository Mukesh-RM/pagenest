import { useLiveQuery } from 'dexie-react-hooks';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ImportResult } from '@/app/contracts';
import { loadResume, type ResumeInfo } from '@/data/resume';
import type { BookSummary as LibraryBook, LibraryQuery, LibraryStatus } from '@/data/library-query';
import {
  DEFAULT_LIBRARY_FILTERS,
  ErrorNotice,
  LibraryScreen as DesignLibraryScreen,
  useSnackbar,
  type BookSummary,
  type RectLike,
  type SheetCloseReason,
} from '@/ui';
import { BookDetailHost, type OpenedBook } from '../components/BookDetailHost';
import { LibraryResume, LibraryResumeSkeleton } from '../components/LibraryResume';
import { SampleBookCard } from '../components/SampleBookCard';
import { useCoverUrls, useLibraryPage } from '../library-hooks';
import { pathForBook } from '../route-paths';
import { hadResumeCard, rememberResumeCard } from '../resume-hint';
import { useServices } from '../services-context';

/** The most books shown at once. The grid is a plain CSS grid, so 500 cards stay smooth; a windowed list can raise this. */
const GRID_LIMIT = 500;

/** The design system's filter chips and what each one asks the data layer for. */
const FILTER_STATUS: Readonly<Record<string, LibraryStatus | undefined>> = {
  all: undefined,
  reading: 'reading',
  listening: 'listening',
  finished: 'finished',
};

/** The design system's screen, memoized: opening a sheet or a snackbar must not re-render the grid. */
const MemoLibraryScreen = memo(DesignLibraryScreen);

type Notice = { kind: 'unavailable' } | { kind: 'failed'; message: string };

/**
 * Library home, built from the design system's `LibraryScreen` and fed by the data worker (search,
 * filter chips, one page at a time). Everything on it does something: tapping a card opens the book
 * detail sheet (Read or Listen, Remove with Undo), the resume card continues where the person
 * stopped, and Add books opens the file picker when the Library owner's `importer` is registered
 * (otherwise it says plainly that adding is not available yet). The "Try a sample book" card shows
 * on an empty library only when a `SampleBookProvider` is registered and available.
 */
export function LibraryPage() {
  const { db, progress, data, sampleBook, importer } = useServices();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const here = useRef(true);
  useEffect(() => {
    here.current = true;
    return () => {
      here.current = false;
    };
  }, []);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const text = useDeferredValue(query).trim();
  const status = FILTER_STATUS[filter];
  const request = useMemo<Partial<LibraryQuery>>(
    () => ({
      limit: GRID_LIMIT,
      ...(text ? { text } : {}),
      ...(status ? { status } : {}),
    }),
    [text, status],
  );
  const { page, error } = useLibraryPage(request);
  const items = page?.items;
  const covers = useCoverUrls(items ?? []);

  const books = useMemo<BookSummary[]>(
    () =>
      (items ?? []).map((b) => ({
        id: b.id,
        title: b.title,
        ...(b.author ? { author: b.author } : {}),
        ...(covers[b.id] ? { coverUrl: covers[b.id] } : {}),
        progress: b.percent / 100,
        audio: b.kind === 'audio',
      })),
    [items, covers],
  );

  // The last saved position (newest progress row of an unfinished book), with its chapter.
  const resume = useLiveQuery(async () => ({ value: await loadResume(db) }), [db, progress]);
  // Reserve the card's space from the first frame if the last visit had one, so nothing jumps.
  const [hadCard] = useState(hadResumeCard);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const shownCard = resume?.value !== undefined;
  useEffect(() => {
    if (resume) rememberResumeCard(shownCard);
  }, [resume, shownCard]);
  const resumeInfo = resume?.value;
  const goResume = useCallback((info: ResumeInfo) => navigate(pathForBook({ id: info.bookId, kind: info.kind })), [navigate]);
  const dismissResume = useCallback(() => setResumeDismissed(true), []);
  const resumeNode = useMemo(
    () =>
      resume === undefined ? (
        hadCard ? (
          <LibraryResumeSkeleton />
        ) : null
      ) : resumeInfo && !resumeDismissed ? (
        <LibraryResume info={resumeInfo} onResume={goResume} onDismiss={dismissResume} />
      ) : null,
    [resume, hadCard, resumeInfo, resumeDismissed, goResume, dismissResume],
  );

  // Open the sample once it is added, unless the person already left the Library meanwhile.
  const openImported = useCallback(
    (result: ImportResult) => {
      if (here.current) navigate(pathForBook({ id: result.bookId, kind: result.kind }));
    },
    [navigate],
  );
  const emptyLibrary = page !== undefined && page.total === 0 && text === '' && status === undefined;
  const sample = useMemo(
    () => (emptyLibrary && sampleBook?.available() ? <SampleBookCard provider={sampleBook} onImported={openImported} /> : null),
    [emptyLibrary, sampleBook, openImported],
  );

  // Add books.
  const [notice, setNotice] = useState<Notice | undefined>();
  const picker = useRef<HTMLInputElement>(null);
  const onAdd = useCallback(() => {
    if (importer?.available()) picker.current?.click();
    else setNotice({ kind: 'unavailable' });
  }, [importer]);
  const onFiles = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = [...(event.target.files ?? [])];
      event.target.value = ''; // so choosing the same file again still fires
      if (!importer || files.length === 0) return;
      importer.importFiles(files).then(
        (outcomes) => {
          const added = outcomes.filter((o) => 'result' in o).length;
          const firstError = outcomes.find((o): o is Extract<typeof o, { error: string }> => 'error' in o);
          if (firstError) setNotice({ kind: 'failed', message: firstError.error });
          if (added > 0)
            snackbar.show({
              message: added === 1 ? 'Added to your library.' : `Added ${added} books to your library.`,
            });
        },
        () =>
          setNotice({
            kind: 'failed',
            message: 'Nothing was added. Please try again.',
          }),
      );
    },
    [importer, snackbar],
  );
  const noticeNode = useMemo(() => {
    const dismiss = () => setNotice(undefined);
    if (notice?.kind === 'unavailable') {
      return (
        <ErrorNotice
          title="Adding books is not ready yet"
          description="This version cannot import files yet. Nothing was lost, and your library stays as it is."
          onDismiss={dismiss}
        />
      );
    }
    if (notice?.kind === 'failed') return <ErrorNotice title="Some files were not added" description={notice.message} onDismiss={dismiss} />;
    if (error && page === undefined) return <ErrorNotice kind="generic" description="Your library could not load. Please reopen the app." />;
    return null;
  }, [notice, error, page]);

  // Book detail.
  const [opened, setOpened] = useState<OpenedBook | undefined>();
  const itemsRef = useRef<readonly LibraryBook[] | undefined>(items);
  itemsRef.current = items;
  const coversRef = useRef(covers);
  coversRef.current = covers;
  const onOpenBook = useCallback((book: BookSummary, rect: RectLike | undefined) => {
    const row = itemsRef.current?.find((b) => b.id === book.id);
    if (row) setOpened({ book: row, coverUrl: coversRef.current[row.id], rect });
  }, []);
  const closeDetail = useCallback((_reason: SheetCloseReason) => setOpened(undefined), []);
  const openBook = useCallback(
    (book: LibraryBook) => {
      setOpened(undefined);
      navigate(pathForBook(book));
    },
    [navigate],
  );
  const removeBook = useCallback(
    (book: LibraryBook) => {
      setOpened(undefined);
      void data.books.trash([book.id]).then(
        (receipt) =>
          snackbar.show({
            message: `Removed “${book.title}”.`,
            onAction: () => void data.books.restore(receipt.token),
            // Undo is gone once the message is: make the removal final (frees the files).
            onDismiss: (reason) => {
              if (reason !== 'action') void data.books.purge(receipt.token);
            },
          }),
        () =>
          setNotice({
            kind: 'failed',
            message: 'That book could not be removed. Nothing was changed.',
          }),
      );
    },
    [data, snackbar],
  );

  return (
    <>
      <MemoLibraryScreen
        books={books}
        loading={page === undefined}
        filters={DEFAULT_LIBRARY_FILTERS}
        filter={filter}
        onFilterChange={setFilter}
        query={query}
        onQueryChange={setQuery}
        onOpenBook={onOpenBook}
        onAdd={onAdd}
        notice={noticeNode}
        resume={resumeNode}
        hint={sample}
      />
      {importer ? (
        <input ref={picker} type="file" multiple accept={importer.accept} tabIndex={-1} aria-hidden="true" className="sr-only" onChange={onFiles} />
      ) : null}
      <BookDetailHost opened={opened} onClose={closeDetail} onRead={openBook} onListen={openBook} onRemoveConfirmed={removeBook} />
    </>
  );
}
