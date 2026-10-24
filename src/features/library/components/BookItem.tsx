import { memo, useCallback } from 'react';
import { Card, Icon } from '@/ui';
import type { FileStore } from '@/data/opfs';
import type { StoredBook } from '@/workers/import/protocol';
import { useCoverUrl } from '../covers';
import { LibIcon } from '../icons';
import { describeBook, formatDuration, formatTag, isFinished } from '../model';
import { TitleCard } from './TitleCard';

export interface BookItemProps {
  book: StoredBook;
  percent: number;
  selected: boolean;
  selecting: boolean;
  view: 'grid' | 'list';
  getFiles: () => Promise<FileStore>;
  onOpen: (book: StoredBook) => void;
  onToggle: (id: string) => void;
  onSelectStart: (id: string) => void;
}

function Cover({ book, getFiles }: { book: StoredBook; getFiles: () => Promise<FileStore> }) {
  const url = useCoverUrl(book, getFiles);
  return (
    <span className="pn-lib-cover">
      {url ? (
        <img className="pn-lib-cover__img" src={url} alt="" decoding="async" draggable={false} />
      ) : (
        <TitleCard title={book.title} author={book.author} seed={`${book.title}\u0000${book.author ?? ''}`} />
      )}
    </span>
  );
}

function Badges({ book, percent }: { book: StoredBook; percent: number }) {
  const finished = isFinished(book, percent);
  return (
    <span className="pn-lib-badges" aria-hidden="true">
      {book.kind === 'audio' ? <Icon name="headphones" size={16} /> : null}
      {book.favorite ? <LibIcon name="heart" size={16} filled /> : null}
      {finished ? <LibIcon name="checkCircle" size={16} /> : null}
    </span>
  );
}

/** One book in the grid or list. Memoized: only the cards whose book, progress or selection changed redraw. */
export const BookItem = memo(function BookItem({ book, percent, selected, selecting, view, getFiles, onOpen, onToggle, onSelectStart }: BookItemProps) {
  const press = useCallback(() => (selecting ? onToggle(book.id) : onOpen(book)), [selecting, onToggle, onOpen, book]);
  const longPress = useCallback(() => onSelectStart(book.id), [onSelectStart, book.id]);
  const label = describeBook(book, percent);
  const shown = Math.max(0, Math.min(100, Math.round(isFinished(book, percent) ? 100 : percent)));
  const detail = book.kind === 'audio' ? formatDuration(book.durationSec) : book.pages ? `${book.pages} pages` : undefined;

  if (view === 'list') {
    return (
      <Card flush onPress={press} onLongPress={longPress} selected={selecting ? selected : undefined} aria-label={label} className="pn-lib-row">
        <Cover book={book} getFiles={getFiles} />
        <span className="pn-lib-rowmeta">
          <span className="pn-lib-title">{book.title}</span>
          {book.author ? <span className="pn-lib-author">{book.author}</span> : null}
          <span className="pn-lib-sub">
            <span className="pn-lib-tag">{formatTag(book)}</span>
            {detail ? <span>{detail}</span> : null}
          </span>
        </span>
        <span className="pn-lib-rowend">
          <Badges book={book} percent={percent} />
          {shown > 0 ? <span className="pn-lib-percent">{shown}%</span> : null}
        </span>
        {selecting ? <SelectMark selected={selected} /> : null}
      </Card>
    );
  }
  return (
    <Card flush onPress={press} onLongPress={longPress} selected={selecting ? selected : undefined} aria-label={label} className="pn-lib-card">
      <Cover book={book} getFiles={getFiles} />
      <span className="pn-lib-tagpill" aria-hidden="true">
        {formatTag(book)}
      </span>
      <Badges book={book} percent={percent} />
      {shown > 0 ? (
        <span className="pn-lib-progress" aria-hidden="true">
          <span className="pn-lib-progress__fill" style={{ width: `${shown}%` }} />
        </span>
      ) : null}
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
