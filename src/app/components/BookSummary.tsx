import type { BookRecord } from '@/data/schema';
import type { ResumeInfo } from '@/data/resume';
import { Link } from 'react-router-dom';
import { BookCover, Card, Icon, ProgressBar } from '@/ui';
import { PageHeader, Screen } from './PageHeader';

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
 * What an audiobook's page shows until its player exists: the cover, who it is, where the person
 * stands, and a plain note that playing comes in a later release. No buttons that do nothing;
 * the one button leaves for the Library.
 */
export function BookSummary({ book, position, note }: BookScreenProps & { note: string }) {
  const percent = Math.round(position?.percent ?? 0);
  return (
    <Screen>
      <div>
        <Link to="/" className="inline-flex min-h-touch items-center gap-2 font-semibold text-[rgb(var(--pn-link))]">
          <Icon name="arrowLeft" size={20} />
          Back to Library
        </Link>
      </div>
      <PageHeader title={book.title} />
      <div className="flex items-start gap-4">
        <div className="w-24 shrink-0">
          <BookCover title={book.title} author={book.author} eager />
        </div>
        <p className="min-h-[1.5rem] min-w-0 text-muted">
          {book.author ? `${book.author} · ` : ''}
          <span className="uppercase">{book.format}</span>
        </p>
      </div>
      <section aria-label="Your place">
        <Card>
          <div className="min-h-[5.5rem] p-4">
            <p className="font-semibold">{heading(position)}</p>
            <p className="line-clamp-1 min-h-[1.5rem] text-sm text-muted">{position?.chapterTitle ?? ''}</p>
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
    </Screen>
  );
}
