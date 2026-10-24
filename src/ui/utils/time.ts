/** "1 h 12 min", "8 min", "45 s": short, plain, no leading zeros. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return `${m} min`;
  return `${seconds} s`;
}

/** Clock format for scrubbers: "3:07" or "1:02:09". */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "1.25×": the speed label, without trailing zeros. */
export function formatSpeed(speed: number): string {
  return `${Number(speed.toFixed(2))}×`;
}

/**
 * Time left in the book at the chosen speed, in plain words: "1 h 12 min left at 1.25×".
 * Playing at 2× halves the remaining wall-clock time, so the label changes with the speed chip.
 */
export function timeLeftLabel(durationSeconds: number, positionSeconds: number, speed: number): string {
  const rate = speed > 0 && Number.isFinite(speed) ? speed : 1;
  const remaining = Math.max(0, durationSeconds - positionSeconds) / rate;
  if (remaining <= 0) return 'Finished';
  return `${formatDuration(remaining)} left at ${formatSpeed(rate)}`;
}
