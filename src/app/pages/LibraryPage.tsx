import { useLiveQuery } from 'dexie-react-hooks';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ImportResult } from '@/app/contracts';
import { EmptyState, ProgressBar, SkeletonCard, SkeletonGroup } from '@/ui';
import { loadResume } from '@/data/resume';
import { PageHeader } from '../components/PageHeader';
import { ResumeCard, ResumeCardSkeleton } from '../components/ResumeCard';
import { SampleBookCard } from '../components/SampleBookCard';
import { pathForBook } from '../route-paths';
import { hadResumeCard, rememberResumeCard } from '../resume-hint';
import { useServices } from '../services-context';

interface BookCardProps {
  title: string;
  author: string | undefined;
  format: string;
  percent: number;
}

/**
 * One book tile. Memoized, and takes plain values (not the database row, which is a new object
 * on every live-query run), so a progress write for one book re-renders only that book's tile.
 */
const BookCard = memo(function BookCard({ title, author, format, percent }: BookCardProps) {
  return (
    <li className="flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-card bg-surface p-3">
      <div>
        <p className="line-clamp-3 font-semibold">{title}</p>
        {author ? <p className="line-clamp-1 text-sm text-muted">{author}</p> : null}
      </div>
      <div>
        <p className="mb-1 text-xs uppercase text-muted">{format}</p>
        <ProgressBar value={percent / 100} label={`Progress for ${title}`} />
      </div>
    </li>
  );
});

/** Library home. Lists what is in the database; shows the empty state when nothing was added yet. */
export function LibraryPage() {
  const { db, progress, sampleBook } = useServices();
  const navigate = useNavigate();
  const here = useRef(true);
  useEffect(() => {
    here.current = true;
    return () => {
      here.current = false;
    };
  }, []);
  // Open the sample once it is added, unless the person already left the Library meanwhile.
  const openImported = useCallback(
    (result: ImportResult) => {
      if (here.current) navigate(pathForBook({ id: result.bookId, kind: result.kind }));
    },
    [navigate],
  );
  const books = useLiveQuery(() => db.books.orderBy('addedAt').reverse().toArray(), [db]);
  const percents = useLiveQuery(async () => {
    const rows = await db.progress.toArray();
    const best = new Map<string, number>();
    for (const r of rows) best.set(r.bookId, Math.max(best.get(r.bookId) ?? 0, r.percent));
    return best;
  }, [db, progress]);

  // The last saved position (newest progress row of an unfinished book), with its chapter.
  const resume = useLiveQuery(async () => ({ value: await loadResume(db) }), [db, progress]);
  // Reserve the card's space from the first frame if the last visit had one, so nothing jumps.
  const [hadCard] = useState(hadResumeCard);
  const shownCard = resume?.value !== undefined;
  useEffect(() => {
    if (resume) rememberResumeCard(shownCard);
  }, [resume, shownCard]);

  const ready = books !== undefined && resume !== undefined;
  const resumeInfo = resume?.value;

  return (
    <>
      <PageHeader title="Library" />
      {!ready ? null : resumeInfo ? <ResumeCard info={resumeInfo} href={pathForBook({ id: resumeInfo.bookId, kind: resumeInfo.kind })} /> : null}
      {!ready && hadCard ? <ResumeCardSkeleton /> : null}
      {!ready ? (
        <SkeletonGroup label="Loading your library">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i}>
                <SkeletonCard />
              </li>
            ))}
          </ul>
        </SkeletonGroup>
      ) : books.length === 0 ? (
        <>
          <EmptyState
            art="bookOpen"
            title="Your shelf is waiting"
            description="Books, PDFs and audiobooks you add will appear here, and they stay on this device. Adding files arrives in the next update."
          />
          {sampleBook?.available() ? <SampleBookCard provider={sampleBook} onImported={openImported} /> : null}
        </>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {books.map((book) => (
            <BookCard key={book.id} title={book.title} author={book.author} format={book.format} percent={Math.round(percents?.get(book.id) ?? 0)} />
          ))}
        </ul>
      )}
    </>
  );
}
