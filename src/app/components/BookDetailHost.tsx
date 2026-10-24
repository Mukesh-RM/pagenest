import { useEffect, useMemo, useState } from 'react';
import type { BookSummary as LibraryBook } from '@/data/library-query';
import { loadBookPosition } from '@/data/resume';
import { BookDetailSheet, ConfirmDialog, type BookDetail, type RectLike, type SheetCloseReason } from '@/ui';
import { useServices } from '../services-context';

export interface OpenedBook {
  readonly book: LibraryBook;
  readonly coverUrl: string | undefined;
  /** Box of the tapped card's cover, for the grow-from-card transition. */
  readonly rect: RectLike | undefined;
}

/**
 * The book detail sheet (design system) for the Library: facts from the library row, the place
 * in plain words from the saved position, Read or Listen by the book's kind, and Remove answered
 * by a confirmation. It keeps its own state, so opening it does not re-render the grid.
 */
export function BookDetailHost({
  opened,
  onClose,
  onRead,
  onListen,
  onRemoveConfirmed,
}: {
  opened: OpenedBook | undefined;
  onClose: (reason: SheetCloseReason) => void;
  onRead: (book: LibraryBook) => void;
  onListen: (book: LibraryBook) => void;
  onRemoveConfirmed: (book: LibraryBook) => void;
}) {
  const { db, progress } = useServices();
  const [where, setWhere] = useState<{ id: string; text: string } | undefined>();
  const [confirming, setConfirming] = useState(false);
  const id = opened?.book.id;

  useEffect(() => {
    if (!id) return undefined;
    let current = true;
    void loadBookPosition(db, progress, id).then(
      (position) => {
        if (current && position?.chapterNumber !== undefined) setWhere({ id, text: `chapter ${position.chapterNumber}` });
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [db, progress, id]);

  // Keep showing the last book while the sheet slides out, so it does not go blank mid-animation.
  const [shown, setShown] = useState<OpenedBook | undefined>(opened);
  useEffect(() => {
    if (opened) setShown(opened);
  }, [opened]);

  const detail = useMemo<BookDetail | undefined>(() => {
    if (!shown) return undefined;
    const { book, coverUrl } = shown;
    return {
      id: book.id,
      title: book.title,
      ...(book.author ? { author: book.author } : {}),
      ...(book.narrator ? { narrator: book.narrator } : {}),
      ...(coverUrl ? { coverUrl } : {}),
      progress: book.percent / 100,
      audio: book.kind === 'audio',
      format: book.format.toUpperCase(),
      ...(book.pages ? { pages: book.pages } : {}),
      ...(book.durationSec ? { durationSeconds: book.durationSec } : {}),
      ...(where?.id === book.id ? { where: where.text } : {}),
    };
  }, [shown, where]);

  const open = opened !== undefined;
  // The confirmation stacks on top of the sheet (newest closes first on the back gesture). If the
  // sheet closes some other way, the confirmation goes with it.
  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);
  return (
    <>
      <BookDetailSheet
        open={open}
        book={detail}
        originRect={shown?.rect}
        onClose={onClose}
        {...(shown?.book.kind === 'audio' ? { onListen: () => onListen(shown.book) } : shown ? { onRead: () => onRead(shown.book) } : {})}
        onRemove={() => setConfirming(true)}
      />
      <ConfirmDialog
        open={open && confirming}
        title="Remove this book?"
        description={`“${shown?.book.title ?? ''}” and your place in it leave this device. You can undo it for a few seconds.`}
        confirmLabel="Remove"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          if (shown) onRemoveConfirmed(shown.book);
        }}
      />
    </>
  );
}
