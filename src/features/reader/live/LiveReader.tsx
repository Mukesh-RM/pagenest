import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isLocatorForMode, type Locator } from '@/app/contracts';
import type { BookScreenProps } from '@/app/components/BookSummary';
import { DEFAULT_READER_SETTINGS, loadReaderSettings, READER_FONTS, saveReaderSettings } from '@/app/reader-settings';
import { useRouteChrome } from '@/app/route-chrome';
import { useServices } from '@/app/services-context';
import { createFileStore, newId } from '@/data';
import type { ReaderPosition } from '@/engines/reader/types';
import { Button, EmptyState, useTheme, type ReaderSettings } from '@/ui';
import { ReaderScreen } from '@/ui/screens';
import { frameThrottle } from '../core/emitter';
import { isReaderError, toReaderError } from '../core/errors';
import type { ReaderDocumentExt } from '../core/ext-types';
import { openStoredBook } from '../core/registry';
import { welcomeBackFor, chapterNumber, type WelcomeBack } from '../core/welcome';
import { getReaderRegistry } from '../registry-instance';
import { Scrubber } from './Scrubber';
import { settingsToAppearance } from './settings-map';
import { TocSheet } from './TocSheet';
import './live.css';

type Phase =
  | { readonly status: 'loading'; readonly message: string }
  | { readonly status: 'ready' }
  | { readonly status: 'error'; readonly title: string; readonly message: string; readonly retry: boolean };

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
 *
 * The engine is chosen from the book's stored `format` (detected from the file's bytes by the Library) and never from the
 * file name. The saved spot comes in as `position.locator` and every move is reported to ProgressService, so the book
 * reopens on the exact same line. Appearance comes from the saved reader settings edited in the Aa sheet.
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
  const [phase, setPhase] = useState<Phase>({ status: 'loading', message: `Opening ${book.title}…` });
  const [doc, setDoc] = useState<ReaderDocumentExt>();
  const [position, setPosition] = useState<ReaderPosition>();
  const [welcome, setWelcome] = useState<WelcomeBack>();
  const [tocVersion, setTocVersion] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [preview, setPreview] = useState<number>();
  const [attempt, setAttempt] = useState(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const appliedRef = useRef<ReaderSettings>();

  // ---- open the book ----
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
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
        // Both reads start together; the saved settings apply even when the file turns out to be missing.
        const filePromise = fileRef ? createFileStore().then((store) => store.open(fileRef)) : Promise.reject(new Error('no file'));
        filePromise.catch(() => undefined);
        const saved = await loadReaderSettings(db, { ...DEFAULT_READER_SETTINGS, theme: appTheme });
        if (abort.signal.aborted) return;
        const current = saved ?? settingsRef.current;
        appliedRef.current = current;
        setSettings(current);
        if (!fileRef) {
          window.clearTimeout(slowTimer);
          setPhase({ status: 'error', title: 'This book has no file', message: 'Add it to your library again to read it.', retry: false });
          return;
        }
        const file = await filePromise.catch(() => {
          throw Object.assign(new Error('The file for this book is missing. Your browser may have cleared it; add the book to your library again.'), { missing: true });
        });
        if (abort.signal.aborted) return;

        // Only a reading position can be used here (the newest saved position may be an audio one).
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
        // A book opened for the first time starts at its text: past a cover or title image, at the first chapter.
        const firstChapter = document_.toc[0]?.locator;
        if (!start && firstChapter?.kind === 'reflow' && firstChapter.section > 0) await document_.goTo(firstChapter);
        if (abort.signal.aborted) return;
        window.clearTimeout(slowTimer);
        const publish = frameThrottle((p: ReaderPosition) => setPosition(p));
        cleanups.push(() => publish.cancel());
        cleanups.push(
          document_.onPositionChange((p) => {
            progress.report(book.id, 'read', p.locator, p.percent);
            publish(p);
          }),
        );
        const first = document_.position();
        setPosition(first);
        setDoc(document_);
        setPhase({ status: 'ready' });
        if (resume) setWelcome(welcomeBackFor(document_, first, resume.percent));
        hostRef.current?.focus({ preventScroll: true });
      } catch (error) {
        window.clearTimeout(slowTimer);
        if (abort.signal.aborted) return;
        if ((error as { missing?: boolean }).missing) {
          setPhase({ status: 'error', title: 'The file for this book is missing', message: (error as Error).message, retry: false });
          return;
        }
        if (toReaderError(error).code !== 'aborted') setPhase(describe(error));
      }
    })();

    return () => {
      abort.abort();
      window.clearTimeout(slowTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const c of cleanups) c();
      if (activeSince) activeMs += performance.now() - activeSince;
      void progress.flush(book.id).catch(() => undefined);
      const seconds = Math.round(activeMs / 1000);
      if (opened && seconds >= MIN_SESSION_SEC) {
        void db.sessions.add({ id: newId(), bookId: book.id, mode: 'read', startedAt, durationSec: seconds }).catch(() => undefined);
      }
      void opened?.close();
    };
    // `resume` and the theme are read once, when the book opens: later changes must not reopen the book.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, book.format, book.fileRef, db, progress, attempt]);

  // ---- settings: apply live, keep saved ----
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

  // ---- page turns, keys, taps ----
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
    if (!doc || settingsOpen || tocOpen) return;
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
    const flip = doc.direction === 'rtl';
    const offs = [
      doc.onKey((e) => keyHandler.current(e, null)),
      doc.onTap((zone) => {
        if (zone !== 'center') void turn(zone === 'left' ? (flip ? 1 : -1) : flip ? -1 : 1);
      }),
      doc.onTocChange(() => setTocVersion((v) => v + 1)),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [doc, turn]);

  const toc = useMemo(() => doc?.toc ?? [], [doc, tocVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const ticks = useMemo(() => doc?.chapterTicks() ?? [], [doc, tocVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const fraction = Math.min(1, Math.max(0, (position?.percent ?? resume?.percent ?? 0) / 100));
  const pages = position?.pageCount;
  const shown = preview ?? fraction;
  const scrubText = doc?.layout === 'fixed' && pages ? `Page ${Math.min(pages, Math.round(shown * (pages - 1)) + 1)} of ${pages}` : `${Math.round(shown * 100)} percent`;
  const minutes = doc && doc.layout === 'reflow' && position ? doc.minutesLeft() : undefined;

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
      {...(doc && toc.length ? { onOpenContents: () => setTocOpen(true) } : {})}
      {...(minutes !== undefined ? { minutesLeftInChapter: minutes } : {})}
    >
      <div className="pn-live">
        <div className="pn-live__stage">
          <div ref={hostRef} className="pn-live__host" tabIndex={-1} role="region" aria-label={`Reading ${book.title}`} />
          {phase.status === 'loading' ? (
            <div className="pn-live__state" role="status" aria-live="polite">
              <div className="pn-live__lines" aria-hidden="true">
                <span className="pn-skeleton pn-skeleton--text" style={{ width: '60%' }} />
                <span className="pn-skeleton pn-skeleton--text" />
                <span className="pn-skeleton pn-skeleton--text" />
                <span className="pn-skeleton pn-skeleton--text" style={{ width: '85%' }} />
                <span className="pn-skeleton pn-skeleton--text" />
              </div>
              <p className="pn-live__message">{phase.message}</p>
            </div>
          ) : null}
          {phase.status === 'error' ? (
            <div className="pn-live__state" role="alert">
              <EmptyState
                art="alert"
                title={phase.title}
                description={phase.message}
                action={{ label: 'Back to Library', onClick: () => navigate('/') }}
              />
              {phase.retry ? (
                <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </Button>
              ) : null}
            </div>
          ) : null}
          {welcome ? <WelcomeCard welcome={welcome} onDismiss={() => setWelcome(undefined)} /> : null}
        </div>
        <div className="pn-live__scrub">
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
        </div>
        <div className="pn-visually-hidden" role="status" aria-live="polite">
          {announce}
        </div>
      </div>
      <TocSheet
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        toc={toc}
        position={position}
        onGoTo={(locator) => {
          setTocOpen(false);
          void doc?.goTo(locator);
        }}
      />
    </ReaderScreen>
  );
}

/** Quiet card shown for a few seconds when a book opens where the reader left off. Not modal; announced politely. */
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
