import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DAY_MS, type StatsSummary } from '@/data/stats';
import { StatsScreen } from '@/ui/screens';
import { useServices } from '../services-context';
import '../screen-styles';

const EMPTY: StatsSummary = { minutesPerDay: Array<number>(7).fill(0), sessionCount: 0, finishedBooks: 0 };

/**
 * Stats (route `/stats`): the design system's `StatsScreen` (four plain numbers and one bar chart,
 * no streaks). The numbers are added up in the data worker, so a long history never blocks scrolling
 * or taps; they refresh when you come back to the app after a reading session.
 */
export function StatsPage() {
  const { data } = useServices();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<StatsSummary | undefined>();

  useEffect(() => {
    let current = true;
    const load = (): void => {
      data.stats(Date.now()).then(
        (next) => current && setSummary(next),
        () => current && setSummary(EMPTY),
      );
    };
    load();
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
  const { dayLabels, dayNames } = useMemo(() => {
    const day = (i: number, weekday: 'short' | 'long'): string => new Date(Date.now() - (6 - i) * DAY_MS).toLocaleDateString(undefined, { weekday });
    const list = days ?? EMPTY.minutesPerDay;
    return { dayLabels: list.map((_, i) => day(i, 'short')), dayNames: list.map((_, i) => day(i, 'long')) };
  }, [days]);

  return (
    <StatsScreen
      loading={summary === undefined}
      minutesPerDay={days ?? EMPTY.minutesPerDay}
      dayLabels={dayLabels}
      dayNames={dayNames}
      sessionCount={summary?.sessionCount ?? 0}
      finishedBooks={summary?.finishedBooks ?? 0}
      emptyAction={{ label: 'Open your library', icon: 'library', onClick: () => navigate('/') }}
    />
  );
}
