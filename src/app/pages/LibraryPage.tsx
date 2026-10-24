import { BookMarked } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { SkeletonGrid } from '../components/Skeleton';
import { useServices } from '../services-context';

/** Library home. Lists what is in the database; shows the empty state when nothing was added yet. */
export function LibraryPage() {
  const { db, progress } = useServices();
  const books = useLiveQuery(() => db.books.orderBy('addedAt').reverse().toArray(), [db]);
  const percents = useLiveQuery(async () => {
    const rows = await db.progress.toArray();
    const best = new Map<string, number>();
    for (const r of rows) best.set(r.bookId, Math.max(best.get(r.bookId) ?? 0, r.percent));
    return best;
  }, [db, progress]);

  return (
    <>
      <PageHeader title="Library" />
      {books === undefined ? (
        <SkeletonGrid />
      ) : books.length === 0 ? (
        <EmptyState icon={BookMarked} title="Your shelf is waiting">
          Books, PDFs and audiobooks you add will appear here, and they stay on this device. Adding files arrives in the
          next update.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {books.map((book) => {
            const percent = Math.round(percents?.get(book.id) ?? 0);
            return (
              <li key={book.id} className="flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-card bg-surface p-3">
                <div>
                  <p className="line-clamp-3 font-semibold">{book.title}</p>
                  {book.author ? <p className="line-clamp-1 text-sm text-muted">{book.author}</p> : null}
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase text-muted">{book.format}</p>
                  <div
                    role="progressbar"
                    aria-label={`Progress for ${book.title}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    className="h-1 rounded-full bg-line"
                  >
                    <div className="h-1 rounded-full bg-accent" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
