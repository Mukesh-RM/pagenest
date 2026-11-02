import { useEffect, useRef } from 'react';
import { BookCover } from '../components/BookCover';
import { BottomSheet, type SheetCloseReason } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { OverflowMenu, type OverflowMenuItem } from '../components/OverflowMenu';
import { ProgressBar } from '../components/ProgressBar';
import { progressWords } from '../components/BookCard';
import { useCoverTint } from '../hooks';
import type { BookDetail } from '../types';
import { isAudioOnly } from '../utils/bookKind';
import { formatDuration } from '../utils/time';
import { playFlip, type RectLike } from '../utils/flip';
import '../styles/screens.css';
import '../styles/surfaces.css';

export interface BookDetailSheetProps {
  open: boolean;
  book: BookDetail | undefined;
  onClose: (reason: SheetCloseReason) => void;
  /** Box of the card's cover when it was tapped. The cover grows out of it (transform and opacity only). */
  originRect?: RectLike;
  onRead?: (book: BookDetail) => void;
  onListen?: (book: BookDetail) => void;
  /** Opens the reader with read-aloud controls (reflow books). */
  onReadAloud?: (book: BookDetail) => void;
  /** "Remove from library" in the ⋯ menu beside the main actions. The app answers with a ConfirmDialog; nothing is deleted here. */
  onRemove?: (book: BookDetail) => void;
  /** "Edit details" in the ⋯ menu, placed before Remove. Without it the item is not offered. The app opens its own editor. */
  onEdit?: (book: BookDetail) => void;
}

/**
 * Book detail (blueprint 5.6): bottom sheet on phones, a two-pane dialog from 1024 px (cover and facts on the left,
 * description and actions on the right). The background takes a tint from the cover, clamped so text stays AA.
 */
export function BookDetailSheet({ open, book, onClose, originRect, onRead, onListen, onReadAloud, onRemove, onEdit }: BookDetailSheetProps) {
  const tint = useCoverTint(book?.coverUrl);
  const coverRef = useRef<HTMLDivElement>(null);

  // Shared transition: the cover grows from its card. Runs once per open, after the sheet is laid out.
  useEffect(() => {
    if (!open || !originRect || !coverRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      if (coverRef.current) playFlip(coverRef.current, originRect);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, originRect, book?.id]);

  if (!book) return null;
  const facts = [
    book.format,
    book.pages ? `${book.pages} pages` : undefined,
    book.durationSeconds ? formatDuration(book.durationSeconds) : undefined,
  ].filter(Boolean);
  const started = book.progress > 0 && book.progress < 1;
  const audioOnly = isAudioOnly(book);
  const menuItems: OverflowMenuItem[] = [];
  if (onEdit) menuItems.push({ label: 'Edit details', icon: 'pencil', onSelect: () => onEdit(book) });
  if (onRemove) menuItems.push({ label: 'Remove from library', icon: 'trash', danger: true, onSelect: () => onRemove(book) });
  return (
    <BottomSheet
      open={open}
      title={book.title}
      onClose={onClose}
      className="pn-tinted pn-detail-sheet"
      style={tint.style}
      footer={
        <div className="pn-detail__actions">
          {audioOnly ? (
            // Audio only: Listen is THE action. There is nothing to read, so Read is not offered.
            onListen ? (
              <Button icon="headphones" onClick={() => onListen(book)}>
                {started ? 'Keep listening' : book.progress >= 1 ? 'Listen again' : 'Listen'}
              </Button>
            ) : null
          ) : (
            <>
              {onRead ? (
                <Button icon="bookOpen" onClick={() => onRead(book)}>
                  {started ? 'Continue reading' : book.progress >= 1 ? 'Read again' : 'Start reading'}
                </Button>
              ) : null}
              {onListen && book.audio ? (
                <Button variant="secondary" icon="headphones" onClick={() => onListen(book)}>
                  {started ? 'Keep listening' : 'Listen'}
                </Button>
              ) : null}
              {onReadAloud && !audioOnly ? (
                <Button variant="secondary" icon="volume" onClick={() => onReadAloud(book)}>
                  Read aloud
                </Button>
              ) : null}
            </>
          )}
          {menuItems.length > 0 ? <OverflowMenu label="More options" items={menuItems} /> : null}
        </div>
      }
    >
      <div className="pn-detail">
        <div className="pn-detail__aside">
          <div ref={coverRef} className="pn-detail__cover">
            <BookCover title={book.title} author={book.author} src={book.coverUrl} eager favorite={book.favorite} />
          </div>
          <div className="pn-detail__meta">
            <p className="pn-detail__author">{book.author ?? 'Unknown author'}</p>
            {book.narrator ? <p className="pn-detail__line">Narrated by {book.narrator}</p> : null}
            {facts.length ? <p className="pn-detail__line">{facts.join(' · ')}</p> : null}
          </div>
        </div>
        <div className="pn-detail__main">
          <div className="pn-detail__progress">
            <ProgressBar value={book.progress} label={progressWords(book)} />
            <p className="pn-detail__line">{progressWords(book)}</p>
          </div>
          {book.description ? <p className="pn-detail__description">{book.description}</p> : null}
        </div>
      </div>
    </BottomSheet>
  );
}

export default BookDetailSheet;
