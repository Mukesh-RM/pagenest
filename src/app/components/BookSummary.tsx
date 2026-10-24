import { Link } from 'react-router-dom';
import type { BookRecord } from '@/data/schema';
import type { ResumeInfo } from '@/data/resume';
import { Card, ProgressBar } from '@/ui';
import { PageHeader } from './PageHeader';

export interface BookScreenProps {
  /** The book, already loaded from the database. */
  book: BookRecord;
  /** Its newest saved position, or `undefined` if it was never opened. */
  position: ResumeInfo | undefined;
}

function heading(position: ResumeInfo | undefined): string {
  if (!position) return 'Not started yet';
  return position.chapterNumber === undefined ? 'Where you stopped' : `You stopped at chapter ${position.chapterNumber}`;
}

/**
 * What a book's page shows until its reader or player exists: who it is, where the person
 * stands, and a plain note that opening it comes in a later release. No buttons that do nothing.
 */
export function BookSummary({ book, position, note }: BookScreenProps & { note: string }) {
  const percent = Math.round(position?.percent ?? 0);
  return (
    <div className="px-[var(--pn-margin)] pb-6 pt-[calc(1rem+var(--pn-safe-top))]">
      <Link to="/" className="inline-flex min-h-touch items-center text-accent">
        Back to Library
      </Link>
      <PageHeader title={book.title} />
      <p className="mb-4 min-h-[24px] text-muted">
        {book.author ? `${book.author} · ` : ''}
        <span className="uppercase">{book.format}</span>
      </p>
      <section aria-label="Your place" className="mb-4">
        <Card>
          <div className="min-h-[88px] p-4">
            <p className="font-semibold">{heading(position)}</p>
            <p className="line-clamp-1 min-h-[24px] text-sm text-muted">{position?.chapterTitle ?? ''}</p>
            <div className="mt-2">
              <ProgressBar value={percent / 100} label={`Progress for ${book.title}`} />
            </div>
            <p className="mt-1 text-sm text-muted">{percent}% done</p>
          </div>
        </Card>
      </section>
      <p role="note" className="text-muted">
        {note}
      </p>
    </div>
  );
}
