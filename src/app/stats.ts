export const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Minutes per day for the last 7 days, oldest first. Exported for tests. */
export function minutesPerDay(sessions: readonly { startedAt: number; durationSec: number }[], now: number): number[] {
  const today = startOfDay(now);
  const days = Array<number>(7).fill(0);
  for (const s of sessions) {
    const index = 6 - Math.round((today - startOfDay(s.startedAt)) / DAY_MS);
    if (index >= 0 && index < 7) days[index] = (days[index] ?? 0) + s.durationSec / 60;
  }
  return days.map((m) => Math.round(m));
}
