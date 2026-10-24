import { useId } from 'react';
import { cx } from '../utils/cx';
import { Button } from './Button';
import { BookCover } from './BookCover';
import type { BookSummary } from '../types';

export interface FinishedMomentProps {
  book: BookSummary;
  /** A kind, factual line such as "You spent 9 h 40 min with it over 3 weeks." Optional. */
  summary?: string;
  /** Primary: the next book to pick up, or the library. */
  onNext: () => void;
  nextLabel?: string;
  /** Quiet extra, for example "Add to a shelf". */
  onSecondary?: () => void;
  secondaryLabel?: string;
  className?: string;
}

/**
 * The finished-book moment: the cover, a calm check, one warm sentence, a clear next step. No confetti and no
 * streak talk. The check ring draws with opacity and transform only; reduced motion shows it still.
 */
export function FinishedMoment({
  book,
  summary,
  onNext,
  nextLabel = 'Pick your next book',
  onSecondary,
  secondaryLabel = 'Add to a shelf',
  className,
}: FinishedMomentProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cx('pn-finished', className)}>
      <div className="pn-finished__stage">
        <div className="pn-finished__cover" aria-hidden="true">
          <BookCover title={book.title} author={book.author} src={book.coverUrl} eager />
        </div>
        <span className="pn-finished__check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      </div>
      <h2 id={headingId} className="pn-finished__heading">
        You finished {book.title}
      </h2>
      <p className="pn-finished__text">{summary ?? 'Nicely done. It is on your Finished shelf whenever you want it again.'}</p>
      <div className="pn-finished__actions">
        <Button block onClick={onNext}>
          {nextLabel}
        </Button>
        {onSecondary ? (
          <Button block variant="ghost" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
