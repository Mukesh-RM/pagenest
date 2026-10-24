import { useRef } from 'react';
import { Icon } from '../icons';
import { cx } from '../utils/cx';
import { measure, rememberFlipOrigin, type RectLike } from '../utils/flip';
import type { BookSummary } from '../types';
import { BookCover } from './BookCover';
import { Card } from './Card';
import { FavoriteBadge } from './FavoriteBadge';
import { ProgressBar } from './ProgressBar';

export interface BookCardProps {
  book: BookSummary;
  /** Tap. Receives the cover's box so a sheet or player can grow the cover out of the card (FLIP). */
  onOpen: (book: BookSummary, coverRect: RectLike | undefined) => void;
  /** Long press, right click or the context-menu key: start multi-select. */
  onSelect?: (book: BookSummary) => void;
  selected?: boolean;
  /** `list`: a compact row (small cover, title, author, progress words). Default `grid`. */
  layout?: 'grid' | 'list';
  /** First screen of covers load eagerly. */
  eager?: boolean;
  className?: string;
}

/** "Not started", "42% read", "Finished": plain words for the progress state. */
export function progressWords(book: Pick<BookSummary, 'progress' | 'audio'>): string {
  const percent = Math.round(Math.min(1, Math.max(0, book.progress)) * 100);
  if (percent >= 100) return 'Finished';
  if (percent <= 0) return 'Not started';
  return `${percent}% ${book.audio ? 'listened' : 'read'}`;
}

/**
 * Library card: cover (or generated title card), title, author, progress bar, headphone badge for audio.
 * A single 44 px+ button, named "Title, Author. Progress".
 */
export function BookCard({ book, onOpen, onSelect, selected, eager, layout = 'grid', className }: BookCardProps) {
  const coverRef = useRef<HTMLSpanElement>(null);
  const words = progressWords(book);
  const label = [book.title, book.author].filter(Boolean).join(', ') + `. ${words}${book.audio ? '. Has audio' : ''}${book.favorite ? '. Favorite' : ''}`;
  return (
    <Card
      flush
      className={cx('pn-bookcard', layout === 'list' && 'pn-bookcard--list', className)}
      aria-label={label}
      selected={selected}
      onPress={() => {
        const rect = measure(coverRef.current);
        rememberFlipOrigin(rect);
        onOpen(book, rect);
      }}
      onLongPress={onSelect ? () => onSelect(book) : undefined}
    >
      <span ref={coverRef} className="pn-bookcard__cover">
        <BookCover title={book.title} author={book.author} src={book.coverUrl} eager={eager} />
        {book.audio ? (
          <span className="pn-bookcard__badge" aria-hidden="true">
            <Icon name="headphones" size={16} />
          </span>
        ) : null}
        {book.favorite ? <FavoriteBadge /> : null}
        {book.progress >= 1 ? (
          <span className="pn-bookcard__badge pn-bookcard__badge--done" aria-hidden="true">
            <Icon name="check" size={16} />
          </span>
        ) : null}
      </span>
      <span className="pn-bookcard__body" aria-hidden="true">
        <span className="pn-bookcard__title">{book.title}</span>
        <span className="pn-bookcard__author">{book.author ?? 'Unknown author'}</span>
        <span className="pn-bookcard__progress">
          <ProgressBar value={book.progress} label={words} />
        </span>
        {layout === 'list' ? <span className="pn-bookcard__words">{words}</span> : null}
      </span>
    </Card>
  );
}
