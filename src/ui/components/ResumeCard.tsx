import { useId } from 'react';
import { cx } from '../utils/cx';
import { Button } from './Button';
import { BookCover } from './BookCover';
import { ProgressBar } from './ProgressBar';
import type { BookSummary } from '../types';

export interface ResumeCardProps {
  book: BookSummary;
  /** Plain-words place: "chapter 7", "page 142". */
  where: string;
  /** Reading or listening decides the button word and the progress label. */
  mode?: 'read' | 'listen';
  onResume: () => void;
  /** Quiet close; the card also goes away once the book is open. */
  onDismiss?: () => void;
  className?: string;
}

/**
 * The quiet "Welcome back" card (excellence bar: perfect resume). No badge, no streaks, no guilt: one warm
 * sentence about where you were, and one button.
 */
export function ResumeCard({ book, where, mode = 'read', onResume, onDismiss, className }: ResumeCardProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cx('pn-resume', className)}>
      <div className="pn-resume__cover" aria-hidden="true">
        <BookCover title={book.title} author={book.author} src={book.coverUrl} eager />
      </div>
      <div className="pn-resume__text">
        <h2 id={headingId} className="pn-resume__heading">
          Welcome back
        </h2>
        <p className="pn-resume__where">
          You were on {where} of <span className="pn-resume__title">{book.title}</span>.
        </p>
        <ProgressBar value={book.progress} label={mode === 'listen' ? 'Listening progress' : 'Reading progress'} />
        <div className="pn-resume__actions">
          <Button onClick={onResume} icon={mode === 'listen' ? 'play' : 'bookOpen'}>
            {mode === 'listen' ? 'Keep listening' : 'Keep reading'}
          </Button>
          {onDismiss ? (
            <Button variant="ghost" onClick={onDismiss}>
              Not now
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
