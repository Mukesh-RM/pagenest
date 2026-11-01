import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { useNavigate } from 'react-router-dom';
import { isLocatorForMode, type Locator } from '@/app/contracts';
import type { BookScreenProps } from '@/app/components/BookSummary';
import { DEFAULT_READER_SETTINGS, loadReaderSettings, READER_FONTS, saveReaderSettings } from '@/app/reader-settings';
import { useRouteChrome } from '@/app/route-chrome';
import { useServices } from '@/app/services-context';
import { resolveFileStore, newId } from '@/data';
import { openBookFile } from '@/data/book-file';
import type { BookmarkRecord, HighlightRecord } from '@/data/schema';
import type { HighlightColor, ReaderPosition, ReaderSelection } from '@/engines/reader/types';
import { Button, useTheme, type ReaderSettings } from '@/ui';
import { ReaderScreen } from '@/ui/screens';
import { frameThrottle } from '../core/emitter';
import { isReaderError, toReaderError } from '../core/errors';
import type { ReaderDocumentExt } from '../core/ext-types';
import { openStoredBook } from '../core/registry';
import { welcomeBackFor, chapterNumber, type WelcomeBack } from '../core/welcome';
import { getReaderRegistry } from '../registry-instance';
import { addBookmark, addHighlight, applyHighlights, clearHighlightNote, deleteHighlight, highlightsWithNotes, loadBookmarks, loadHighlights, setHighlightNote } from './marks';
import { MarksSheet } from './MarksSheet';
import { NoteEditorSheet } from './NoteEditorSheet';
import { SearchSheet } from './SearchSheet';
import { SelectionBar } from './SelectionBar';
import { ensureReadableStart } from './open-position';
import { settingsToAppearance } from './settings-map';
import { currentReaderTocId, locatorForReaderTocId, readerTocFromEngine } from './toc-map';
import './live.css';

const ReaderNarration = lazy(() =>
  Promise.all([
    import('@/features/player/PlayerProvider'),
    import('@/features/narration/ReaderNarrationHost'),
  ]).then(([providerMod, hostMod]) => ({
    default: function ReaderNarrationWithAudio(
      props: ComponentProps<typeof hostMod.default>,
    ) {
      return (
        <providerMod.PlayerProvider>
          <hostMod.default {...props} />
        </providerMod.PlayerProvider>
      );
    },
  })),
);
const DictionaryHost = lazy(() => import('@/features/dictionary/DictionaryHost'));

type Phase =
  | { readonly status: 'loading'; readonly message: string }
  | { readonly status: 'ready' }
  | { readonly status: 'error'; readonly title: string; readonly message: string; readonly retry: boolean };

/** Save the reading spot this long after the last move (the service itself only saves every 5 s). */
const SETTLE_SAVE_MS = 700;
const SLOW_OPEN_MS = 1200;
const MIN_SESSION_SEC = 5;
const EDITABLE = /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/;

/** Until the book is open, the saved chapter and percent stand in, so the bar already says where you are. */
function savedLine(resume: BookScreenProps['position']): string {
  if (!resume) return 'Opening…';
  if (resume.chapterNumber === undefined) return `${Math.round(resume.percent)}% through the book`;
  return resume.chapterTitle ? `Chapter ${resume.chapterNumber}: ${resume.chapterTitle}` : `Chapter ${resume.chapterNumber}`;
}

function chapterLine(doc: ReaderDocumentExt | undefined, position: ReaderPosition | undefined, resume: BookScreenProps['position']): string {
  if (!doc || !position) return savedLine(resume);
  if (doc.layout === 'fixed' && position.page) return position.pageCount ? `Page ${position.page} of ${position.pageCount}` : `Page ${position.page}`;
  const n = chapterNumber(doc.chapterTicks(), position.percent / 100);
  if (n > 0) return position.chapterTitle ? `Chapter ${n}: ${position.chapterTitle}` : `Chapter ${n}`;
  return position.chapterTitle ?? `${Math.round(position.percent)}% through the book`;
}

function describe(error: unknown): Phase {
  const err = toReaderError(error);
  const own = isReaderError(error) ? error.message : err.message;
  switch (err.code) {
    case 'drm':
      return { status: 'error', title: 'This book is protected', message: own, retry: false };
    case 'unsupported':
      return { status: 'error', title: 'We can’t open this kind of file yet', message: own, retry: false };
    default:
      return { status: 'error', title: 'This file looks damaged', message: own, retry: true };
  }
}

/**
 * `/read/:id`: the design system's reader screen with a real book in it.
 */
export default function LiveReader({ book, position: resume }: BookScreenProps) {
  useRouteChrome('immersive');
  const { db, progress } = useServices();
  const navigate = useNavigate();
  const appTheme = useTheme().theme;
  const hostRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<ReaderSettings>({ ...DEFAULT_READER_SETTINGS, theme: appTheme });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [marksOpen, setMarksOpen] = useState(false);
  const [marksPanel, setMarksPanel] = useState<'bookmarks' | 'highlights' | 'notes'>('bookmarks');
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<HighlightRecord>();
  const [selection, setSelection] = useState<ReaderSelection>();
  const [highlights, setHighlights] = useState<readonly HighlightRecord[]>([]);
  const [bookmarks, setBookmarks] = useState<readonly BookmarkRecord[]>([]);
  const [phase, setPhase] = useState<Phase>({ status: 'loading', message: `Opening ${book.title}…` });
  const [doc, setDoc] = useState<ReaderDocumentExt>();
  const [position, setPosition] = useState<ReaderPosition>();
  const [welcome, setWelcome] = useState<WelcomeBack>();
  const [tocVersion, setTocVersion] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [preview, setPreview] = useState<number>();
  const [attempt, setAttempt] = useState(0);
  const [dictToken, setDictToken] = useState(0);
  const [dictMode, setDictMode] = useState<'define' | 'translate' | undefined>();
  const [dictOpen, setDictOpen] = useState(false);
  const [wordTap, setWordTap] = useState<{ token: number; word: string; anchor: DOMRect } | undefined>();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const appliedRef = useRef<ReaderSettings>();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    host.classList.add('pn-live__host--settling');
    const endSettling = (): void => {
      host.classList.remove('pn-live__host--settling');
    };
    const abort = new AbortController();
    const cleanups: Array<() => void> = [];
    let opened: ReaderDocumentExt | undefined;
    let slowTimer = 0;
    let activeSince = document.visibilityState === 'visible' ? performance.now() : 0;
    let activeMs = 0;
    const startedAt = Date.now();
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') activeSince = performance.now();
      else if (activeSince) {
        activeMs += performance.now() - activeSince;
        activeSince = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    setPhase({ status: 'loading', message: `Opening ${book.title}…` });
    setDoc(undefined);
    setPosition(undefined);
    setWelcome(undefined);

    void (async () => {
      try {
        slowTimer = window.setTimeout(() => setPhase({ status: 'loading', message: 'Still opening. Large files take a moment.' }), SLOW_OPEN_MS);
        const fileRef = book.fileRef;
        const filePromise = fileRef
          ? resolveFileStore().then((store) => openBookFile(store, book))
          : Promise.reject(new Error('no file'));
        filePromise.catch(() => undefined);
        const saved = await loadReaderSettings(db, { ...DEFAULT_READER_SETTINGS, theme: appTheme });
        if (abort.signal.aborted) return;
        const current = saved ?? settingsRef.current;
        appliedRef.current = current;
        setSettings(current);
        if (!fileRef) {
          window.clearTimeout(slowTimer);
          endSettling();
          setPhase({ status: 'error', title: 'This book has no file', message: 'Add it to your library again to read it.', retry: false });
          return;
        }
        const file = await filePromise.catch(() => {
          throw Object.assign(new Error('The file for this book is missing. Your browser may have cleared it; add the book to your library again.'), { missing: true });
        });
        if (abort.signal.aborted) return;

        const start: Locator | undefined = resume && isLocatorForMode(resume.locator, 'read') ? resume.locator : undefined;
        const document_ = await openStoredBook(
          getReaderRegistry(),
          { id: book.id, format: book.format },
          file,
          host,
          { appearance: settingsToAppearance(current), signal: abort.signal, ...(start ? { locator: start } : {}) },
        );
        if (abort.signal.aborted) {
          await document_.close();
          return;
        }
        opened = document_;
        if (!start && host) await ensureReadableStart(document_, host);
        if (abort.signal.aborted) return;
        window.clearTimeout(slowTimer);
        const publish = frameThrottle((p: ReaderPosition) => setPosition(p));
        cleanups.push(() => publish.cancel());
        let settleFlush: number | undefined;
        cleanups.push(() => window.clearTimeout(settleFlush));
        cleanups.push(
          document_.onPositionChange((p) => {
            progress.report(book.id, 'read', p.locator, p.percent);
            window.clearTimeout(settleFlush);
            settleFlush = window.setTimeout(() => void progress.flush(book.id).catch(() => undefined), SETTLE_SAVE_MS);
            publish(p);
          }),
        );
        const first = document_.position();
        setPosition(first);
        setDoc(document_);
        endSettling();
        setPhase({ status: 'ready' });
        void import('@/app/offline-assets')
          .then((m) =>
            book.format === 'pdf'
              ? m.persistLoadedEngineChunks(m.ENGINE_PDF_CHUNK)
              : m.persistLoadedEngineChunks(m.ENGINE_FOLIATE_CHUNK, m.ENGINE_FOLIATE_FORMATS_CHUNK),
          )
          .catch(() => undefined);
        if (resume) setWelcome(welcomeBackFor(document_, first, resume.percent));
        hostRef.current?.focus({ preventScroll: true });
      } catch (error) {
        window.clearTimeout(slowTimer);
        endSettling();
        if (abort.signal.aborted) return;
        if ((error as { missing?: boolean }).missing) {
          endSettling();
          setPhase({ status: 'error', title: 'The file for this book is missing', message: (error as Error).message, retry: false });
          return;
        }
        if (toReaderError(error).code !== 'aborted') {
          endSettling();
          setPhase(describe(error));
        }
      }
    })();

    return () => {
      endSettling();
      abort.abort();
      window.clearTimeout(slowTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const c of cleanups) c();
      void progress.flush(book.id).catch(() => undefined);
      const seconds = Math.round(activeMs / 1000);
      if (opened && seconds >= MIN_SESSION_SEC) {
        void db.sessions.add({ id: newId(), bookId: book.id, mode: 'read', startedAt, durationSec: seconds }).catch(() => undefined);
      }
      void opened?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, book.format, book.fileRef, db, progress, attempt]);

  const notes = useMemo(() => highlightsWithNotes(highlights), [highlights]);

  const openNoteEditor = useCallback((row: HighlightRecord) => {
    setNoteTarget(row);
    setNoteEditorOpen(true);
  }, []);

  useEffect(() => {
    if (!doc) {
      setSelection(undefined);
      setHighlights([]);
      setBookmarks([]);
      return undefined;
    }
    const refreshMarks = (): void => {
      void loadHighlights(db, book.id).then((rows) => {
        applyHighlights(doc, rows);
        setHighlights(rows);
      });
      void loadBookmarks(db, book.id).then(setBookmarks);
    };
    refreshMarks();
    return doc.onSelectionChange(setSelection);
  }, [doc, book.id, db]);

  useEffect(() => {
    if (!doc) {
      setWordTap(undefined);
      return undefined;
    }
    return doc.onWordTap(({ word, anchor }) => {
      setWordTap({ token: performance.now(), word, anchor });
    });
  }, [doc]);

  /** E2E builds: foliate iframe pointer synthesis is flaky; tests dispatch `pn-mock-word-tap` on the host. */
  useEffect(() => {
    if (import.meta.env.VITE_PN_MOCK_DICTIONARY !== '1') return undefined;
    const host = hostRef.current;
    if (!host || !doc) return undefined;
    const onMockTap = (ev: Event): void => {
      const word = (ev as CustomEvent<{ word?: string }>).detail?.word?.trim();
      if (!word) return;
      const box = host.getBoundingClientRect();
      setWordTap({
        token: performance.now(),
        word,
        anchor: new DOMRect(box.width * 0.4, box.height * 0.4, 48, 24),
      });
    };
    host.addEventListener('pn-mock-word-tap', onMockTap);
    return () => host.removeEventListener('pn-mock-word-tap', onMockTap);
  }, [doc]);

  const selectionAnchor = doc && selection ? doc.selectionRect() : undefined;

  useEffect(() => {
    if (!marksOpen || !doc) return;
    void loadBookmarks(db, book.id).then(setBookmarks);
    void loadHighlights(db, book.id).then(setHighlights);
  }, [marksOpen, doc, book.id, db]);

  const saveBookmark = useCallback(() => {
    if (!doc) return;
    const locator = position?.locator ?? doc.position().locator;
    void addBookmark(db, book.id, locator, doc.currentLabel()).then((row) => setBookmarks((list) => [...list, row]));
  }, [book.id, db, doc, position]);

  const saveHighlight = useCallback(
    (color: HighlightColor) => {
      if (!doc || !selection) return;
      void addHighlight(db, book.id, doc, selection.range, selection.text, color).then((row) => setHighlights((list) => [...list, row]));
      setSelection(undefined);
    },
    [book.id, db, doc, selection],
  );

  const onSettingsChange = useCallback(
    (next: ReaderSettings) => {
      setSettings(next);
      void saveReaderSettings(db, next);
    },
    [db],
  );
  useEffect(() => {
    if (!doc) return;
    if (appliedRef.current === settings) return;
    appliedRef.current = settings;
    void doc.applyAppearance(settingsToAppearance(settings));
  }, [doc, settings]);

  const say = useCallback((text: string) => {
    setAnnounce('');
    window.setTimeout(() => setAnnounce(text), 30);
  }, []);
  const turn = useCallback(
    async (dir: 1 | -1) => {
      if (!doc) return;
      const moved = dir === 1 ? await doc.next() : await doc.prev();
      if (!moved) say(dir === 1 ? 'You are at the end of the book.' : 'You are at the start of the book.');
    },
    [doc, say],
  );
  const keyHandler = useRef<(key: { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; preventDefault(): void }, target: EventTarget | null) => void>(() => undefined);
  keyHandler.current = (e, target) => {
    if (!doc || settingsOpen || tocOpen || searchOpen || marksOpen || noteEditorOpen) return;
    if (target instanceof HTMLElement && (EDITABLE.test(target.tagName) || target.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const flip = doc.direction === 'rtl';
    const go = (dir: 1 | -1): void => {
      e.preventDefault();
      void turn(dir);
    };
    switch (e.key) {
      case 'ArrowRight':
        return go(flip ? -1 : 1);
      case 'ArrowLeft':
        return go(flip ? 1 : -1);
      case 'ArrowDown':
      case 'PageDown':
        return go(1);
      case 'ArrowUp':
      case 'PageUp':
        return go(-1);
      case ' ':
        return go(e.shiftKey ? -1 : 1);
      case 'Home':
        e.preventDefault();
        void doc.goToFraction(0);
        return;
      case 'End':
        e.preventDefault();
        void doc.goToFraction(1);
        return;
      case '/':
        e.preventDefault();
        setSearchOpen(true);
        return;
      case 'b':
      case 'B':
        e.preventDefault();
        saveBookmark();
        return;
      default:
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => keyHandler.current(e, e.target);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!doc) return undefined;
    const offs = [doc.onKey((e) => keyHandler.current(e, null)), doc.onTocChange(() => setTocVersion((v) => v + 1))];
    return () => {
      for (const off of offs) off();
    };
  }, [doc]);

  const engineToc = useMemo(() => doc?.toc ?? [], [doc, tocVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const { tree: readerToc, flat: tocEntries } = useMemo(() => readerTocFromEngine(engineToc), [engineToc]);
  const engineTocFlat = useMemo(() => {
    const flat: { item: (typeof engineToc)[number] }[] = [];
    const walk = (items: typeof engineToc): void => {
      for (const item of items) {
        flat.push({ item });
        if (item.children?.length) walk(item.children);
      }
    };
    walk(engineToc);
    return flat;
  }, [engineToc]);

  const ticks = useMemo(() => doc?.chapterTicks() ?? [], [doc, tocVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const fraction = Math.min(1, Math.max(0, (position?.percent ?? resume?.percent ?? 0) / 100));
  const pages = position?.pageCount;
  const shown = preview ?? fraction;
  const scrubText = doc?.layout === 'fixed' && pages ? `Page ${Math.min(pages, Math.round(shown * (pages - 1)) + 1)} of ${pages}` : `${Math.round(shown * 100)} percent`;
  const minutes = doc && doc.layout === 'reflow' && position ? doc.minutesLeft() : undefined;
  const tocCurrentId = currentReaderTocId(engineTocFlat, position, tocEntries);
  const flip = doc?.direction === 'rtl';

  return (
    <ReaderScreen
      title={book.title}
      chapter={chapterLine(doc, position, resume)}
      progress={fraction}
      settings={settings}
      fonts={READER_FONTS}
      onSettingsChange={onSettingsChange}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={setSettingsOpen}
      onBack={() => navigate('/')}
      {...(minutes !== undefined ? { minutesLeftInChapter: minutes } : {})}
      immersiveChrome
      onPagePrev={() => void turn(flip ? 1 : -1)}
      onPageNext={() => void turn(flip ? -1 : 1)}
      chapterTicks={ticks}
      progressLabel={scrubText}
      scrubDisabled={!doc}
      onScrubPreview={setPreview}
      onScrubCommit={(f) => {
        setPreview(undefined);
        void doc?.goToFraction(f);
      }}
      toc={readerToc.length ? readerToc : undefined}
      tocOpen={tocOpen}
      onTocOpenChange={setTocOpen}
      {...(tocCurrentId ? { tocCurrentId } : {})}
      onTocSelect={(item) => {
        const locator = locatorForReaderTocId(tocEntries, item.id);
        if (locator) void doc?.goTo(locator);
      }}
      paginated
      twoColumn={phase.status === 'ready' && doc?.layout === 'reflow'}
      loading={phase.status === 'loading' ? { message: phase.message } : undefined}
      error={
        phase.status === 'error'
          ? {
              title: phase.title,
              message: phase.message,
              ...(phase.retry ? { onRetry: () => setAttempt((n) => n + 1), retryLabel: 'Try again' } : {}),
            }
          : undefined
      }
      statusMessage={announce}
      barTools={
        <>
          <Button iconOnly variant="ghost" icon="search" aria-label="Search in this book" disabled={!doc} onClick={() => setSearchOpen(true)} />
          <Button iconOnly variant="ghost" icon="bookmark" aria-label="Add bookmark here" disabled={!doc} onClick={saveBookmark} />
          <Button variant="ghost" icon="list" className="pn-reader__marks" aria-label="Bookmarks and highlights" disabled={!doc} onClick={() => setMarksOpen(true)}>
            <span className="pn-reader__marks-label">Marks</span>
          </Button>
        </>
      }
    >
      <div className="pn-live">
        <div className="pn-live__stage">
          {selection ? (
            <SelectionBar
              selection={selection}
              onHighlight={saveHighlight}
              onDefine={() => {
                setDictMode('define');
                setDictOpen(true);
                setDictToken((n) => n + 1);
              }}
              onTranslate={() => {
                setDictMode('translate');
                setDictOpen(true);
                setDictToken((n) => n + 1);
              }}
              onDismiss={() => {
                doc?.clearSelection();
                setSelection(undefined);
              }}
            />
          ) : null}
          <div ref={hostRef} className="pn-live__host" tabIndex={-1} role="region" aria-label={`Reading ${book.title}`} />
          {phase.status === 'ready' && doc ? (
            <Suspense fallback={null}>
              <DictionaryHost
                hostRef={hostRef}
                selection={selection}
                {...(selectionAnchor ? { selectionAnchor } : {})}
                {...(wordTap ? { wordTap } : {})}
                {...(book.language ? { bookLanguage: book.language } : {})}
                lookupToken={dictToken}
                lookupMode={dictOpen ? dictMode : undefined}
                onClose={() => {
                  setDictOpen(false);
                  setDictMode(undefined);
                }}
              />
            </Suspense>
          ) : null}
          {welcome ? <WelcomeCard welcome={welcome} onDismiss={() => setWelcome(undefined)} /> : null}
        </div>
        {phase.status === 'ready' && doc && doc.layout === 'reflow' ? (
          <Suspense fallback={null}>
            <ReaderNarration book={book} doc={doc} hostRef={hostRef} />
          </Suspense>
        ) : null}
      </div>
      <SearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        doc={doc}
        onJump={(hit) => {
          setSearchOpen(false);
          void doc?.goToRange(hit.range);
        }}
      />
      <MarksSheet
        open={marksOpen}
        onClose={() => setMarksOpen(false)}
        bookmarks={bookmarks}
        highlights={highlights}
        notes={notes}
        panel={marksPanel}
        onPanelChange={setMarksPanel}
        onGoToBookmark={(row) => {
          setMarksOpen(false);
          void doc?.goTo(row.locator);
        }}
        onGoToHighlight={(row) => {
          setMarksOpen(false);
          void doc?.goToRange(row.range);
        }}
        onEditNote={(row) => {
          openNoteEditor(row);
        }}
      />
      <NoteEditorSheet
        open={noteEditorOpen}
        highlight={noteTarget}
        onClose={() => setNoteEditorOpen(false)}
        onSave={(text) => {
          if (!noteTarget) return;
          void setHighlightNote(db, noteTarget, text).then((next) => {
            setHighlights((list) => list.map((h) => (h.id === next.id ? next : h)));
            setNoteTarget(next);
            setNoteEditorOpen(false);
            setMarksPanel('notes');
          });
        }}
        onDeleteNote={() => {
          if (!noteTarget) return;
          void clearHighlightNote(db, noteTarget).then((next) => {
            setHighlights((list) => list.map((h) => (h.id === next.id ? next : h)));
            setNoteTarget(next);
            setNoteEditorOpen(false);
          });
        }}
        onDeleteHighlight={() => {
          if (!noteTarget || !doc) return;
          void deleteHighlight(db, doc, noteTarget).then(() => {
            setHighlights((list) => list.filter((h) => h.id !== noteTarget.id));
            setNoteEditorOpen(false);
            setNoteTarget(undefined);
          });
        }}
      />
    </ReaderScreen>
  );
}

function WelcomeCard({ welcome, onDismiss }: { welcome: WelcomeBack; onDismiss: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="pn-live__welcome" role="status" aria-live="polite">
      <div className="pn-live__welcome-text">
        <p className="pn-live__welcome-title">{welcome.headline}</p>
        <p className="pn-live__welcome-detail">{welcome.detail}</p>
      </div>
      <Button iconOnly variant="ghost" icon="close" aria-label="Dismiss" onClick={onDismiss} />
    </div>
  );
}
