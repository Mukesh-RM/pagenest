import { memo, useCallback, useEffect, useState } from 'react';
import { Card, Icon } from '@/ui';
import { useCoverUrl } from '@/app/library-hooks';
import type { BookSummary } from '@/data/library-query';
import { LibIcon } from '../icons';
import { describeBook, formatDuration, formatTag, isFinished } from '../model';
import { TitleCard } from './TitleCard';

export interface BookItemProps {
  book: BookSummary;
  selected: boolean;
  selecting: boolean;
  view: 'grid' | 'list';
  onOpen: (book: BookSummary) => void;
  onToggle: (id: string) => void;
  onSelectStart: (id: string) => void;
}

const COVER_DELAY_MS = 90;

/** A cover is asked for only after its card stayed on screen a moment, so a fast scroll decodes nothing. */
function Cover({ book, children }: { book: BookSummary; children?: React.ReactNode }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), COVER_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  const url = useCoverUrl(book.id, settled && book.coverRef !== undefined);
  return (
    <span className="pn-lib-cover">
      {url ? (
        <img className="pn-lib-cover__img" src={url} alt="" decoding="async" draggable={false} />
      ) : (
        <TitleCard title={book.title} author={book.author} seed={`${book.title}\u0000${book.author ?? ''}`} />
      )}
      {children}
    </span>
  );
}

function Badges({ book }: { book: BookSummary }) {
  const finished = isFinished(book, book.percent);
  return (
    <span className="pn-lib-badges" aria-hidden="true">
      {book.kind === 'audio' ? <Icon name="headphones" size={16} /> : null}
      {book.favorite ? <LibIcon name="heart" size={16} filled /> : null}
      {finished ? <LibIcon name="checkCircle" size={16} /> : null}
    </span>
  );
}

/** One book in the grid or list. Memoized: only the cards whose book, progress or selection changed redraw. */
export const BookItem = memo(function BookItem({ book, selected, selecting, view, onOpen, onToggle, onSelectStart }: BookItemProps) {
  const percent = book.percent;
  const press = useCallback(() => (selecting ? onToggle(book.id) : onOpen(book)), [selecting, onToggle, onOpen, book]);
  const longPress = useCallback(() => onSelectStart(book.id), [onSelectStart, book.id]);
  const label = describeBook(book, percent);
  const shown = Math.max(0, Math.min(100, Math.round(isFinished(book, percent) ? 100 : percent)));
  const detail = book.kind === 'audio' ? formatDuration(book.durationSec) : book.pages ? `${book.pages} pages` : undefined;

  if (view === 'list') {
    return (
      <Card flush onPress={press} onLongPress={longPress} selected={selecting ? selected : undefined} aria-label={label} className="pn-lib-row">
        <Cover book={book} />
        <span className="pn-lib-rowmeta">
          <span className="pn-lib-title">{book.title}</span>
          {book.author ? <span className="pn-lib-author">{book.author}</span> : null}
          <span className="pn-lib-sub">
            <span className="pn-lib-tag">{formatTag(book)}</span>
            {detail ? <span>{detail}</span> : null}
          </span>
        </span>
        <span className="pn-lib-rowend">
          <Badges book={book} />
          {shown > 0 ? <span className="pn-lib-percent">{shown}%</span> : null}
        </span>
        {selecting ? <SelectMark selected={selected} /> : null}
      </Card>
    );
  }
  return (
    <Card flush onPress={press} onLongPress={longPress} selected={selecting ? selected : undefined} aria-label={label} className="pn-lib-card">
      <Cover book={book}>
        {shown > 0 ? (
          <span className="pn-lib-progress" aria-hidden="true">
            <span className="pn-lib-progress__fill" style={{ width: `${shown}%` }} />
          </span>
        ) : null}
      </Cover>
      <span className="pn-lib-tagpill" aria-hidden="true">
        {formatTag(book)}
      </span>
      <Badges book={book} />
      <span className="pn-lib-meta">
        <span className="pn-lib-title">{book.title}</span>
        {book.author ? <span className="pn-lib-author">{book.author}</span> : null}
      </span>
      {selecting ? <SelectMark selected={selected} /> : null}
    </Card>
  );
});

function SelectMark({ selected }: { selected: boolean }) {
  return (
    <span className={selected ? 'pn-lib-mark pn-lib-mark--on' : 'pn-lib-mark'} aria-hidden="true">
      {selected ? <Icon name="check" size={16} /> : null}
    </span>
  );
}
