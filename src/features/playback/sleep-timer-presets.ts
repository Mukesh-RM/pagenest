import type { SleepTimerSpec } from '@/engines/audio/types';

/** Preset sleep durations (minutes). Shared by player and narration. */
export const SLEEP_PRESET_MINUTES = [5, 10, 15, 30, 45, 60] as const;

export const SLEEP_CUSTOM_MIN = 1;
export const SLEEP_CUSTOM_MAX = 480;

/** Extra time added when the device is shaken while a sleep timer runs. */
export const SHAKE_EXTEND_SEC = 5 * 60;

export function sleepSpecLabel(spec: SleepTimerSpec): string {
  if (spec.kind === 'endOfChapter') return 'End of chapter';
  return `${spec.minutes} min`;
}

export function sleepSpecsEqual(a: SleepTimerSpec | null | undefined, b: SleepTimerSpec | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'minutes' && b.kind === 'minutes') return a.minutes === b.minutes;
  return true;
}

export function parseCustomSleepMinutes(raw: string): number | undefined {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < SLEEP_CUSTOM_MIN || n > SLEEP_CUSTOM_MAX) return undefined;
  return n;
}
