import type { PageNestDB } from './db';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight of the day containing `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Minutes per day for the 7 days ending today, oldest first. Sessions outside the window are ignored. */
export function minutesPerDay(sessions: readonly { startedAt: number; durationSec: number }[], now: number): number[] {
  const today = startOfDay(now);
  const days = Array<number>(7).fill(0);
  for (const s of sessions) {
    const index = 6 - Math.round((today - startOfDay(s.startedAt)) / DAY_MS);
    if (index >= 0 && index < 7) days[index] = (days[index] ?? 0) + s.durationSec / 60;
  }
  return days.map((m) => Math.round(m));
}

/** Everything the Stats screen shows. */
export interface StatsSummary {
  /** Minutes read or listened on each of the last 7 days, oldest first. */
  readonly minutesPerDay: number[];
  /** Number of sessions in that window. */
  readonly sessionCount: number;
  /** Books marked finished. */
  readonly finishedBooks: number;
}

/**
 * Compute the summary. Reads only the last 7 days of sessions through the `startedAt` index
 * (not the whole table) and scans books once for the finished count. Meant to run in a worker.
 */
export async function computeStats(db: PageNestDB, now: number): Promise<StatsSummary> {
  const since = new Date(startOfDay(now));
  since.setDate(since.getDate() - 6);
  const [sessions, finishedBooks] = await Promise.all([
    db.sessions.where('startedAt').aboveOrEqual(since.getTime()).toArray(),
    db.books.filter((b) => b.finished).count(),
  ]);
  return { minutesPerDay: minutesPerDay(sessions, now), sessionCount: sessions.length, finishedBooks };
}
