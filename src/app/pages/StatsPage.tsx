import { useEffect, useMemo, useState } from 'react';
import { DAY_MS, type StatsSummary } from '@/data/stats';
import { EmptyState, Illustration } from '@/ui';
import { PageHeader, Screen } from '../components/PageHeader';
import { useServices } from '../services-context';
import '../screen-styles';

/** Reading and listening time. Simple bars, no clutter (blueprint 5.6). */
export function StatsPage() {
  const { data } = useServices();
  const [summary, setSummary] = useState<StatsSummary | undefined>();

  // The numbers are added up in a worker, so a long history never blocks scrolling or taps.
  useEffect(() => {
    let current = true;
    const load = (): void => {
      data.stats(Date.now()).then(
        (next) => current && setSummary(next),
        () => current && setSummary({ minutesPerDay: Array<number>(7).fill(0), sessionCount: 0, finishedBooks: 0 }),
      );
    };
    load();
    // Refresh when coming back to the app, e.g. after a reading session.
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      current = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [data]);

  const days = summary?.minutesPerDay;
  const labels = useMemo(
    () => (days ?? []).map((_, i) => new Date(Date.now() - (6 - i) * DAY_MS).toLocaleDateString(undefined, { weekday: 'short' })),
    [days],
  );

  if (summary === undefined || days === undefined) {
    return (
      <Screen>
        <PageHeader title="Stats" />
      </Screen>
    );
  }
  const max = Math.max(1, ...days);

  return (
    <Screen>
      <PageHeader title="Stats" />
      {summary.sessionCount === 0 ? (
        <EmptyState
          art={<Illustration name="chart" />}
          title="Nothing to count yet"
          description="Your reading and listening time will show up here, a little each day. There is no pressure and no streak to keep."
        />
      ) : (
        <section aria-label="Last 7 days" className="rounded-card bg-surface p-4">
          <p className="mb-4 text-sm text-muted">Minutes per day, last 7 days. Finished books: {summary.finishedBooks}.</p>
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
    </Screen>
  );
}
