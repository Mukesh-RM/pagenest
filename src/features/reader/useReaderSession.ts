import { useEffect, useRef, useState, type RefObject } from 'react';
import { useServices } from '@/app/services-context';
import { createFileStore, newId, type FileStore } from '@/data';
import type { BookRecord } from '@/data/schema';
import type { ReaderPosition } from '@/engines/reader/types';
import { frameThrottle } from './core/emitter';
import { isReaderError, READER_ERROR_MESSAGES, toReaderError } from './core/errors';
import type { ReaderDocumentExt } from './core/ext-types';
import { openStoredBook } from './core/registry';
import { welcomeBackFor, type WelcomeBack } from './core/welcome';
import { getReaderRegistry } from './registry-instance';
import { useAppearance } from './state/appearance-store';

export type SessionState =
  | { readonly status: 'loading'; readonly message: string }
  | { readonly status: 'ready' }
  | { readonly status: 'error'; readonly title: string; readonly message: string; readonly kind: 'missing' | 'drm' | 'corrupt' | 'unsupported' | 'storage' };

export interface ReaderSession {
  readonly state: SessionState;
  readonly book: BookRecord | undefined;
  readonly doc: ReaderDocumentExt | undefined;
  readonly position: ReaderPosition | undefined;
  readonly welcome: WelcomeBack | undefined;
  dismissWelcome(): void;
  /** Open the book again after an error. */
  retry(): void;
}

const SLOW_OPEN_MS = 1200;
const MIN_SESSION_SEC = 5;

/**
 * Open a stored book and keep its position saved.
 *
 * Routing is by the book's stored format (`book.format`, detected from the file's bytes by the Library); the file's
 * name is never read. The saved position comes from ProgressService, and every position change goes back to it.
 */
export function useReaderSession(bookId: string, hostRef: RefObject<HTMLDivElement | null>): ReaderSession {
  const { db, progress } = useServices();
  const [state, setState] = useState<SessionState>({ status: 'loading', message: 'Finding your book…' });
  const [book, setBook] = useState<BookRecord>();
  const [doc, setDoc] = useState<ReaderDocumentExt>();
  const [position, setPosition] = useState<ReaderPosition>();
  const [welcome, setWelcome] = useState<WelcomeBack>();
  const [attempt, setAttempt] = useState(0);
  const storeRef = useRef<Promise<FileStore>>();

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

    setState({ status: 'loading', message: 'Finding your book…' });
    setBook(undefined);
    setDoc(undefined);
    setPosition(undefined);
    setWelcome(undefined);

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') activeSince = performance.now();
      else if (activeSince) {
        activeMs += performance.now() - activeSince;
        activeSince = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    void (async () => {
      try {
        const row = await db.books.get(bookId);
        if (abort.signal.aborted) return;
        if (!row) {
          setState({ status: 'error', kind: 'missing', title: 'We can’t find this book', message: 'It may have been removed from your library.' });
          return;
        }
        setBook(row);
        if (!row.fileRef) {
          setState({ status: 'error', kind: 'missing', title: 'This book has no file', message: 'Add it to your library again to read it.' });
          return;
        }
        setState({ status: 'loading', message: `Opening ${row.title}…` });
        slowTimer = window.setTimeout(() => setState({ status: 'loading', message: 'Still opening. Large files take a moment.' }), SLOW_OPEN_MS);

        storeRef.current ??= createFileStore();
        const store = await storeRef.current;
        let file: File;
        try {
          file = await store.open(row.fileRef);
        } catch {
          if (abort.signal.aborted) return;
          setState({ status: 'error', kind: 'missing', title: 'The file for this book is missing', message: 'Your browser may have cleared it. Add the book to your library again.' });
          return;
        }
        const [saved, appearance] = await Promise.all([
          progress.get(row.id, 'read').catch(() => undefined),
          useAppearance.getState().loaded ? Promise.resolve(useAppearance.getState().appearance) : useAppearance.getState().load(db),
        ]);
        if (abort.signal.aborted) return;
        setState({ status: 'loading', message: 'Preparing your pages…' });

        const document_ = await openStoredBook(
          getReaderRegistry(),
          { id: row.id, format: row.format },
          file,
          host,
          { appearance, signal: abort.signal, ...(saved ? { locator: saved.locator } : {}) },
        );
        if (abort.signal.aborted) {
          await document_.close();
          return;
        }
        opened = document_;
        window.clearTimeout(slowTimer);

        const publish = frameThrottle((p: ReaderPosition) => setPosition(p));
        cleanups.push(() => publish.cancel());
        cleanups.push(
          document_.onPositionChange((p) => {
            progress.report(row.id, 'read', p.locator, p.percent);
            publish(p);
          }),
        );
        const first = document_.position();
        setPosition(first);
        setDoc(document_);
        setState({ status: 'ready' });
        if (saved) setWelcome(welcomeBackFor(document_, first, saved.percent));
        void db.books.update(row.id, { lastOpenedAt: Date.now() }).catch(() => undefined);
      } catch (error) {
        window.clearTimeout(slowTimer);
        if (abort.signal.aborted) return;
        const err = toReaderError(error);
        if (err.code === 'aborted') return;
        setState(describe(err.code, isReaderError(error) ? error.message : undefined));
      }
    })();

    return () => {
      abort.abort();
      window.clearTimeout(slowTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const c of cleanups) c();
      if (activeSince) activeMs += performance.now() - activeSince;
      void progress.flush(bookId).catch(() => undefined);
      const seconds = Math.round(activeMs / 1000);
      if (opened && seconds >= MIN_SESSION_SEC) {
        void db.sessions.add({ id: newId(), bookId, mode: 'read', startedAt, durationSec: seconds }).catch(() => undefined);
      }
      void opened?.close();
    };
  }, [bookId, db, progress, hostRef, attempt]);

  return {
    state,
    book,
    doc,
    position,
    welcome,
    dismissWelcome: () => setWelcome(undefined),
    retry: () => setAttempt((n) => n + 1),
  };
}

function describe(code: 'drm' | 'corrupt' | 'unsupported' | 'aborted', message: string | undefined): SessionState {
  switch (code) {
    case 'drm':
      return { status: 'error', kind: 'drm', title: 'This book is protected', message: message ?? READER_ERROR_MESSAGES.drm };
    case 'unsupported':
      return { status: 'error', kind: 'unsupported', title: 'We can’t open this kind of file yet', message: message ?? READER_ERROR_MESSAGES.unsupported };
    default:
      return { status: 'error', kind: 'corrupt', title: 'This file looks damaged', message: message ?? READER_ERROR_MESSAGES.corrupt };
  }
}
