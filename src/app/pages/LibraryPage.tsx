import { useLiveQuery } from 'dexie-react-hooks';
import { EmptyState, ProgressBar, SkeletonCard, SkeletonGroup } from '@/ui';
import { PageHeader } from '../components/PageHeader';
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
        <EmptyState
          art="bookOpen"
          title="Your shelf is waiting"
          description="Books, PDFs and audiobooks you add will appear here, and they stay on this device. Adding files arrives in the next update."
        />
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
                  <ProgressBar value={percent / 100} label={`Progress for ${book.title}`} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
