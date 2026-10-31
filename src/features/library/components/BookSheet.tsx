import { useEffect, useId, useState } from 'react';
import { BottomSheet, Button } from '@/ui';
import type { BookSummary } from '@/data/library-query';
import { formatDuration, formatTag } from '../model';

export interface BookSheetProps {
  book: BookSummary | undefined;
  onClose: () => void;
  /** Resolves with a plain-words problem, or `undefined` when saved. */
  onSave: (id: string, details: { title: string; author: string }) => Promise<string | undefined>;
}

/** Edit a book's title and author. Everything else about the file is shown, not editable. */
export function BookSheet({ book, onClose, onSave }: BookSheetProps) {
  const titleId = useId();
  const authorId = useId();
  const errorId = useId();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setTitle(book?.title ?? '');
    setAuthor(book?.author ?? '');
    setProblem(undefined);
  }, [book?.id, book?.title, book?.author]);

  const facts = book
    ? [formatTag(book), formatDuration(book.durationSec), book.pages ? `${book.pages} pages` : undefined, `Added ${new Date(book.addedAt).toLocaleDateString()}`].filter(Boolean).join(' · ')
    : '';
  async function save(): Promise<void> {
    if (!book || busy) return;
    setBusy(true);
    const message = await onSave(book.id, { title, author });
    setBusy(false);
    if (message) setProblem(message);
    else onClose();
  }
  return (
    <BottomSheet open={book !== undefined} onClose={onClose} title="Book details">
      <form
        className="pn-lib-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor={titleId}>Title</label>
        <input id={titleId} className="pn-lib-field" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={problem !== undefined} aria-describedby={problem ? errorId : undefined} maxLength={300} />
        <label htmlFor={authorId}>Author</label>
        <input id={authorId} className="pn-lib-field" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={200} />
        {problem ? (
          <p id={errorId} role="alert" className="pn-lib-error">
            {problem}
          </p>
        ) : null}
        <p className="pn-lib-sheet-note">{facts}</p>
        <div className="pn-lib-sheet-actions">
          <Button type="submit" block disabled={busy}>
            Save
          </Button>
          <Button variant="secondary" block onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
