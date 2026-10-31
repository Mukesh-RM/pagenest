/** Plain-word helpers for the Stats screen. Pure, so they are unit tested and the screen stays presentational. */

export interface WeekFigures {
  /** Minutes in the whole window. */
  totalMinutes: number;
  /** Days with at least one minute. */
  activeDays: number;
  /** Index of the day with the most minutes, or -1 when every day is empty. Ties go to the latest day. */
  bestDay: number;
  bestMinutes: number;
  /** Tallest bar, never below 1 so bars can be scaled by it. */
  maxMinutes: number;
}

export function weekFigures(minutesPerDay: readonly number[]): WeekFigures {
  const days = minutesPerDay.map((m) => (Number.isFinite(m) && m > 0 ? m : 0));
  let bestDay = -1;
  let bestMinutes = 0;
  days.forEach((m, i) => {
    if (m > 0 && m >= bestMinutes) {
      bestDay = i;
      bestMinutes = m;
    }
  });
  return {
    totalMinutes: days.reduce((a, b) => a + b, 0),
    activeDays: days.filter((m) => m > 0).length,
    bestDay,
    bestMinutes,
    maxMinutes: Math.max(1, ...days),
  };
}

/** "45 min", "1 h 5 min", "2 h": minutes in plain words. */
export function minutesLabel(minutes: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  return `${total} min`;
}

/** Bar height as a 0..1 share of the tallest bar. Any non-empty day is at least 4 % so it never vanishes. */
export function barShare(minutes: number, max: number): number {
  if (!(minutes > 0) || !(max > 0)) return 0;
  return Math.min(1, Math.max(0.04, minutes / max));
}
