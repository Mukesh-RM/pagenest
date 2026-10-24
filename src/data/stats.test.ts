import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageNestDB } from './db';
import { computeStats, DAY_MS, minutesPerDay, startOfDay } from './stats';

const NOW = new Date(2026, 5, 15, 14, 30).getTime(); // 15 June 2026, 14:30 local

function session(id: string, daysAgo: number, durationSec: number) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(9, 0, 0, 0);
  return { id, bookId: 'b1', mode: 'read' as const, startedAt: d.getTime(), durationSec };
}

describe('minutesPerDay', () => {
  it('buckets sessions into the last 7 days, oldest first, and ignores older ones', () => {
    const days = minutesPerDay([session('a', 0, 600), session('b', 0, 300), session('c', 6, 120), session('d', 7, 9999)], NOW);
    expect(days).toEqual([2, 0, 0, 0, 0, 0, 15]);
  });

  it('startOfDay is local midnight', () => {
    const start = startOfDay(NOW);
    expect(new Date(start).getHours()).toBe(0);
    expect(NOW - start).toBeLessThan(DAY_MS);
  });
});

describe('computeStats', () => {
  let db: PageNestDB;
  beforeEach(() => {
    db = new PageNestDB(`stats-${Math.random()}`);
  });
  afterEach(async () => {
    db.close();
    await db.delete();
  });

  const book = (id: string, finished: boolean) => ({
    id,
    fingerprint: `fp-${id}`,
    kind: 'ebook' as const,
    format: 'epub' as const,
    title: id,
    addedAt: 1,
    favorite: false,
    finished,
  });

  it('is empty for an empty database', async () => {
    expect(await computeStats(db, NOW)).toEqual({ minutesPerDay: [0, 0, 0, 0, 0, 0, 0], sessionCount: 0, finishedBooks: 0 });
  });

  it('counts the last 7 days of sessions and finished books', async () => {
    await db.sessions.bulkAdd([session('a', 0, 600), session('b', 3, 1800), session('old', 30, 7200)]);
    await db.books.bulkAdd([book('x', true), book('y', false), book('z', true)]);
    const stats = await computeStats(db, NOW);
    expect(stats.sessionCount).toBe(2);
    expect(stats.finishedBooks).toBe(2);
    expect(stats.minutesPerDay[6]).toBe(10);
    expect(stats.minutesPerDay[3]).toBe(30);
    expect(stats.minutesPerDay.reduce((a, b) => a + b, 0)).toBe(40);
  });
});
