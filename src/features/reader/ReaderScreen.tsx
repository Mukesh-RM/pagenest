import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Locator, TextRange } from '@/app/contracts';
import { useServices } from '@/app/services-context';
import type { HighlightRecord } from '@/data/schema';
import type { HighlightColor, ReaderAppearance, ReaderSelection, SearchHit } from '@/engines/reader/types';
import { ThemeScope, cx, useReducedMotion, useSnackbar } from '@/ui';
import { themeColors } from './core/appearance';
import { baseThemeFor } from './core/base-theme';
import { parseColor } from './core/color';
import { formatMinutes } from './core/emitter';
import type { KeyboardLike } from './core/ext-types';
import { addBookmark, addHighlight, bookmarkIsHere, listBookmarks, listHighlights, removeBookmark, removeHighlight, updateHighlight } from './state/annotations';
import { useAppearance } from './state/appearance-store';
import './reader.css';
import { useReaderSession } from './useReaderSession';
import { AaSheet } from './ui/AaSheet';
import { ContentsSheet, type ContentsTab } from './ui/ContentsSheet';
import { HighlightSheet } from './ui/HighlightSheet';
import { Bookmark, BookmarkCheck, ALargeSmall, ChevronLeft, List, Search } from './ui/icons';
import { IconButton } from './ui/IconButton';
import { ErrorState, FootnoteSheet, ImageViewer, OpeningState, WelcomeCard } from './ui/Overlays';
import { Scrubber } from './ui/Scrubber';
import { SearchSheet } from './ui/SearchSheet';
import { SelectionToolbar } from './ui/SelectionToolbar';

type Sheet = 'aa' | 'contents' | 'search' | undefined;

const EDITABLE = /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/;

function triplet(color: string): string | undefined {
  const c = parseColor(color);
  return c ? `${c.r} ${c.g} ${c.b}` : undefined;
}

/** One book open in the reader: page area, top and bottom bars, sheets and the selection toolbar. */
export function ReaderScreen({ bookId }: { bookId: string }) {
  const { db } = useServices();
  const navigate = useNavigate();
  const location = useLocation();
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const session = useReaderSession(bookId, hostRef);
  const { doc, book, position, state } = session;
  const appearance = useAppearance((s) => s.appearance);
  const reducedMotion = useReducedMotion();
  const snackbar = useSnackbar();

  const [chrome, setChrome] = useState(true);
  const [sheet, setSheet] = useState<Sheet>();
  const [tab, setTab] = useState<ContentsTab>('contents');
  const [selection, setSelection] = useState<{ value: ReaderSelection; rect: DOMRect }>();
  const [editingId, setEditingId] = useState<string>();
  const [image, setImage] = useState<{ src: string; alt: string }>();
  const [note, setNote] = useState<{ text: string }>();
  const [announce, setAnnounce] = useState('');
  const [preview, setPreview] = useState<number>();
  const [tocVersion, setTocVersion] = useState(0);
  const [searchActive, setSearchActive] = useState(false);

  const highlights = useLiveQuery(() => listHighlights(db, bookId), [db, bookId]);
  const bookmarks = useLiveQuery(() => listBookmarks(db, bookId), [db, bookId]);
  const sheetOpen = sheet !== undefined || editingId !== undefined || image !== undefined || note !== undefined;

  // ---- appearance ----
  const appliedRef = useRef<ReaderAppearance>();
  useEffect(() => {
    if (!doc) return;
    if (appliedRef.current === undefined) {
      appliedRef.current = appearance;
      return;
    }
    appliedRef.current = appearance;
    void doc.applyAppearance(appearance);
  }, [doc, appearance, reducedMotion]);
  useEffect(() => {
    appliedRef.current = undefined;
  }, [doc]);
  const changeAppearance = useCallback((patch: Partial<ReaderAppearance>) => void useAppearance.getState().update(db, patch), [db]);

  // ---- highlights on the page ----
  const shown = useRef(new Map<string, string>());
  useEffect(() => {
    shown.current.clear();
  }, [doc]);
  useEffect(() => {
    if (!doc || !highlights) return;
    const wanted = new Map(highlights.map((h) => [h.id, h] as const));
    for (const [id] of shown.current) {
      if (!wanted.has(id)) {
        doc.hideHighlight(id);
        shown.current.delete(id);
      }
    }
    for (const h of highlights) {
      const sig = `${h.color}:${JSON.stringify(h.range)}`;
      if (shown.current.get(h.id) === sig) continue;
      doc.showHighlight(h.id, h.range, h.color);
      shown.current.set(h.id, sig);
    }
  }, [doc, highlights]);

  // ---- actions ----
  const say = useCallback((text: string) => {
    setAnnounce('');
    window.setTimeout(() => setAnnounce(text), 30);
  }, []);

  const hideChromeIfIdle = useCallback(() => {
    const active = document.activeElement;
    const inChrome = active instanceof HTMLElement && active.closest('.pn-reader__bar');
    if (inChrome) hostRef.current?.focus({ preventScroll: true });
    setChrome(false);
  }, []);

  const turn = useCallback(
    async (dir: 1 | -1) => {
      if (!doc) return;
      setSelection(undefined);
      const moved = dir === 1 ? await doc.next() : await doc.prev();
      if (!moved) say(dir === 1 ? 'You are at the end of the book.' : 'You are at the start of the book.');
      else if (chrome) hideChromeIfIdle();
    },
    [doc, say, chrome, hideChromeIfIdle],
  );

  const goBack = useCallback(() => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/', { replace: true });
  }, [location.key, navigate]);

  const toggleBookmark = useCallback(async () => {
    if (!doc || !position) return;
    const here = (bookmarks ?? []).filter((b) => bookmarkIsHere(b.locator, position.locator));
    if (here.length) {
      await Promise.all(here.map((b) => removeBookmark(db, b.id)));
      snackbar.show({ message: 'Bookmark removed', onAction: () => void db.bookmarks.bulkPut(here) });
    } else {
      await addBookmark(db, { bookId, locator: position.locator, label: doc.currentLabel() });
      say('Bookmark added');
    }
  }, [doc, position, bookmarks, db, bookId, say, snackbar]);

  const copyText = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        say('Copied');
      } catch {
        say('Copying is not allowed here. Select the text and use your browser’s copy.');
      }
    },
    [say],
  );

  const makeHighlight = useCallback(
    async (color: HighlightColor, thenNote = false) => {
      if (!doc || !selection) return;
      const { value } = selection;
      const row = await addHighlight(db, { bookId, range: value.range, text: value.text, color });
      doc.clearSelection();
      setSelection(undefined);
      if (thenNote) setEditingId(row.id);
      else say('Highlight added');
    },
    [doc, selection, db, bookId, say],
  );

  const goToLocator = useCallback(
    (locator: Locator) => {
      setSheet(undefined);
      void doc?.goTo(locator);
    },
    [doc],
  );
  const goToRange = useCallback(
    (range: TextRange) => {
      setSheet(undefined);
      void doc?.goToRange(range);
    },
    [doc],
  );

  const pickHit = useCallback(
    (hit: SearchHit, all: readonly TextRange[]) => {
      setSheet(undefined);
      doc?.showSearchHits(all);
      setSearchActive(true);
      void doc?.goToRange(hit.range);
    },
    [doc],
  );
  const clearSearch = useCallback(() => {
    doc?.showSearchHits([]);
    setSearchActive(false);
  }, [doc]);
  useEffect(() => setSearchActive(false), [doc]);

  // ---- keyboard and taps ----
  const handleKey = useCallback(
    (e: KeyboardLike, target?: EventTarget | null): void => {
      if (!doc || sheetOpen) return;
      if (target instanceof HTMLElement && (EDITABLE.test(target.tagName) || target.isContentEditable) && !(e.key === 'ArrowRight' || e.key === 'ArrowLeft')) return;
      if (target instanceof HTMLInputElement) return;
      const flip = doc.direction === 'rtl';
      const scrolled = appearance.pageTurn === 'scroll';
      const mod = e.ctrlKey || e.metaKey;
      const plain = !mod && !e.altKey;
      const go = (dir: 1 | -1): void => {
        e.preventDefault();
        void turn(dir);
      };
      if ((mod && e.key.toLowerCase() === 'f') || (plain && e.key === '/')) {
        e.preventDefault();
        setSheet('search');
        return;
      }
      if (!plain) return;
      switch (e.key) {
        case 'ArrowRight':
          return go(flip ? -1 : 1);
        case 'ArrowLeft':
          return go(flip ? 1 : -1);
        case 'PageDown':
          return go(1);
        case 'PageUp':
          return go(-1);
        case ' ':
          return go(e.shiftKey ? -1 : 1);
        case 'ArrowDown':
          if (doc.layout === 'reflow' && !scrolled) go(1);
          return;
        case 'ArrowUp':
          if (doc.layout === 'reflow' && !scrolled) go(-1);
          return;
        case 'Home':
          e.preventDefault();
          void doc.goToFraction(0);
          return;
        case 'End':
          e.preventDefault();
          void doc.goToFraction(1);
          return;
        case 'Escape':
          setChrome((v) => !v);
          return;
        case 'c':
          setTab('contents');
          setSheet('contents');
          return;
        case 'b':
          void toggleBookmark();
          return;
        case 't':
          setSheet('aa');
          return;
        case '+':
        case '=':
        case '-':
        case '_': {
          const up = e.key === '+' || e.key === '=';
          if (doc.zoom) doc.zoom.set(doc.zoom.get() * (up ? 1.2 : 1 / 1.2));
          else changeAppearance({ fontSizePx: appearance.fontSizePx + (up ? 2 : -2) });
          return;
        }
        default:
      }
    },
    [doc, sheetOpen, appearance.pageTurn, appearance.fontSizePx, turn, toggleBookmark, changeAppearance],
  );
  const keyRef = useRef(handleKey);
  keyRef.current = handleKey;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => keyRef.current(e, e.target);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!doc) return undefined;
    const flip = doc.direction === 'rtl';
    const offs = [
      doc.onKey((e) => keyRef.current(e, null)),
      doc.onTap((zone) => {
        setSelection(undefined);
        if (zone === 'center') setChrome((v) => !v);
        else void turn(zone === 'left' ? (flip ? 1 : -1) : flip ? -1 : 1);
      }),
      doc.onSelectionChange((value) => {
        const rect = value ? doc.selectionRect() : undefined;
        setSelection(value && rect ? { value, rect } : undefined);
      }),
      doc.onPositionChange(() => setSelection(undefined)),
      doc.onHighlightTap((id) => setEditingId(id)),
      doc.onImageTap(setImage),
      doc.onFootnote(setNote),
      doc.onTocChange(() => setTocVersion((v) => v + 1)),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [doc, turn]);

  // Put keyboard focus on the page once a book is open, so arrow keys work at once.
  useEffect(() => {
    if (doc) hostRef.current?.focus({ preventScroll: true });
  }, [doc]);

  // ---- derived ----
  const toc = useMemo(() => doc?.toc ?? [], [doc, tocVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const ticks = useMemo(() => doc?.chapterTicks() ?? [], [doc, tocVersion, position?.pageCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const bookmarked = Boolean(position && bookmarks?.some((b) => bookmarkIsHere(b.locator, position.locator)));
  const editing: HighlightRecord | undefined = highlights?.find((h) => h.id === editingId);
  const fixed = doc?.layout === 'fixed';
  const colors = themeColors(appearance);
  const fraction = Math.min(1, Math.max(0, (position?.percent ?? 0) / 100));
  const pages = position?.pageCount;
  const previewFraction = preview ?? fraction;
  const scrubText = fixed && pages ? `Page ${Math.min(pages, Math.round(previewFraction * (pages - 1)) + 1)} of ${pages}` : `${Math.round(previewFraction * 100)} percent`;
  const minutes = !fixed && position ? doc?.minutesLeft() : undefined;
  const rightText = fixed && pages && position?.page ? `Page ${position.page} of ${pages}` : `${Math.round(fraction * 100)}%${minutes !== undefined ? ` · ${formatMinutes(minutes)} left` : ''}`;
  const base = baseThemeFor(appearance);
  const customVars =
    appearance.theme === 'custom' && appearance.custom
      ? ({ ['--pn-page']: triplet(appearance.custom.page), ['--pn-text']: triplet(appearance.custom.text) } as React.CSSProperties)
      : undefined;
  const stage = stageRef.current?.getBoundingClientRect();

  return (
    <ThemeScope theme={base} className="pn-reader">
      <div className="pn-reader__root" style={{ ...customVars, ['--pn-reader-page' as string]: colors.page }} data-chrome={chrome ? 'shown' : 'hidden'} data-layout={doc?.layout ?? 'loading'}>
        <div ref={stageRef} className="pn-reader__stage">
          <div ref={hostRef} className="pn-reader__host" tabIndex={-1} role="region" aria-label={book ? `Reading ${book.title}` : 'Reading'} />
          {state.status === 'loading' ? <OpeningState message={state.message} /> : null}
          {state.status === 'error' ? <ErrorState kind={state.kind} title={state.title} message={state.message} onBack={goBack} onRetry={state.kind === 'missing' ? undefined : session.retry} /> : null}

          {state.status === 'ready' ? (
            <div className={cx('pn-reader__status', fixed && 'pn-reader__status--pill')} aria-hidden="true">
              {!fixed ? <span className="pn-reader__status-left">{position?.chapterTitle ?? ''}</span> : null}
              <span className="pn-reader__status-right">{rightText}</span>
            </div>
          ) : null}

          {session.welcome ? <WelcomeCard welcome={session.welcome} onDismiss={session.dismissWelcome} /> : null}

          {selection && stage && !sheetOpen ? (
            <SelectionToolbar
              rect={selection.rect}
              stage={stage}
              onColor={(c) => void makeHighlight(c)}
              onNote={() => void makeHighlight('yellow', true)}
              onCopy={() => {
                void copyText(selection.value.text);
                doc?.clearSelection();
                setSelection(undefined);
              }}
            />
          ) : null}

          {searchActive ? (
            <button type="button" className="pn-chip pn-reader__clear-search" onClick={clearSearch}>
              Clear search marks
            </button>
          ) : null}
        </div>

        <header className="pn-reader__bar pn-reader__top" aria-label="Reader controls" data-visible={chrome}>
          <IconButton icon={ChevronLeft} label="Back to Library" onClick={goBack} />
          <div className="pn-reader__title">
            <h1 className="pn-reader__book">{book?.title ?? doc?.metadata.title ?? 'Opening…'}</h1>
            {position?.chapterTitle ? <p className="pn-reader__chapter">{position.chapterTitle}</p> : null}
          </div>
          <IconButton icon={Search} label="Search in book" shortcut="/" disabled={!doc || fixed === undefined} onClick={() => setSheet('search')} />
          <IconButton icon={bookmarked ? BookmarkCheck : Bookmark} label={bookmarked ? 'Remove bookmark' : 'Add bookmark'} shortcut="b" pressed={bookmarked} disabled={!doc} onClick={() => void toggleBookmark()} />
          <IconButton
            icon={List}
            label="Contents, bookmarks and highlights"
            shortcut="c"
            disabled={!doc}
            onClick={() => {
              setTab('contents');
              setSheet('contents');
            }}
          />
          <IconButton icon={ALargeSmall} label="Text and look" shortcut="t" disabled={!doc} onClick={() => setSheet('aa')} />
        </header>

        <footer className="pn-reader__bar pn-reader__bottom" aria-label="Page scrubber" data-visible={chrome}>
          <span className="pn-reader__scrub-label">{position?.chapterTitle ?? (fixed ? '' : 'Start')}</span>
          <Scrubber
            value={fraction}
            ticks={ticks}
            valueText={scrubText}
            disabled={!doc}
            onPreview={setPreview}
            onCommit={(f) => {
              setPreview(undefined);
              void doc?.goToFraction(f);
            }}
          />
          <span className="pn-reader__scrub-value">{preview !== undefined ? scrubText.replace(' percent', '%') : rightText}</span>
        </footer>
      </div>

      <div className="pn-visually-hidden" role="status" aria-live="polite">
        {announce}
      </div>

      <AaSheet open={sheet === 'aa'} onClose={() => setSheet(undefined)} appearance={appearance} onChange={changeAppearance} fixed={Boolean(fixed)} {...(doc?.zoom ? { zoom: doc.zoom } : {})} />
      <ContentsSheet
        open={sheet === 'contents'}
        tab={tab}
        onTab={setTab}
        onClose={() => setSheet(undefined)}
        toc={toc}
        position={position}
        bookmarks={bookmarks ?? []}
        highlights={highlights ?? []}
        onGoTo={goToLocator}
        onGoToRange={goToRange}
        onRemoveBookmark={(b) => {
          void removeBookmark(db, b.id);
          snackbar.show({ message: 'Bookmark removed', onAction: () => void db.bookmarks.put(b) });
        }}
        onEditHighlight={(h) => {
          setSheet(undefined);
          setEditingId(h.id);
        }}
      />
      <SearchSheet open={sheet === 'search'} onClose={() => setSheet(undefined)} doc={doc} onPick={pickHit} />
      <HighlightSheet
        highlight={editing}
        onClose={() => setEditingId(undefined)}
        onColor={(color) => void updateHighlight(db, editing?.id ?? '', { color })}
        onNote={(text) => void updateHighlight(db, editing?.id ?? '', { note: text })}
        onDelete={() => {
          if (editing) {
            const row = editing;
            void removeHighlight(db, row.id);
            snackbar.show({ message: 'Highlight deleted', onAction: () => void db.highlights.put(row) });
          }
          setEditingId(undefined);
        }}
        onCopy={() => editing && void copyText(editing.text)}
      />
      <ImageViewer image={image} onClose={() => setImage(undefined)} />
      <FootnoteSheet note={note} onClose={() => setNote(undefined)} />
    </ThemeScope>
  );
}
