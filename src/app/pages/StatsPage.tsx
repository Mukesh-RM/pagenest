import { BarChart3 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { useServices } from '../services-context';
import { DAY_MS, minutesPerDay } from '../stats';

/** Reading and listening time. Simple bars, no clutter (blueprint 5.6). */
export function StatsPage() {
  const { db } = useServices();
  const sessions = useLiveQuery(() => db.sessions.toArray(), [db]);
  const finished = useLiveQuery(() => db.books.filter((b) => b.finished).count(), [db]);

  if (sessions === undefined) return <PageHeader title="Stats" />;

  const days = minutesPerDay(sessions, Date.now());
  const max = Math.max(1, ...days);
  const labels = days.map((_, i) => new Date(Date.now() - (6 - i) * DAY_MS).toLocaleDateString(undefined, { weekday: 'short' }));

  return (
    <>
      <PageHeader title="Stats" />
      {sessions.length === 0 ? (
        <EmptyState icon={BarChart3} title="Nothing to count yet">
          Your reading and listening time will show up here, a little each day. There is no pressure and no streak to
          keep.
        </EmptyState>
      ) : (
        <section aria-label="Last 7 days" className="rounded-card bg-surface p-4">
          <p className="mb-4 text-sm text-muted">
            Minutes per day, last 7 days. Finished books: {finished ?? 0}.
          </p>
          <ul className="flex h-40 items-end gap-2">
            {days.map((minutes, i) => (
              <li key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs text-muted">{minutes}</span>
                <div
                  className="w-full rounded-t bg-accent"
                  style={{ height: `${Math.max(2, (minutes / max) * 100)}px` }}
                  role="img"
                  aria-label={`${labels[i]}: ${minutes} minutes`}
                />
                <span className="text-xs">{labels[i]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
