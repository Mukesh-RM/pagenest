import type { PageNestDB } from '@/data/db';
import { getSetting, setSetting } from '@/data/settings';
import type { SleepTimerSpec } from '@/engines/audio/types';
import { SLEEP_CUSTOM_MAX, SLEEP_CUSTOM_MIN, SLEEP_PRESET_MINUTES } from './sleep-timer-presets';

export const LAST_SLEEP_TIMER_KEY = 'lastSleepTimerSpec';

function isEndOfChapter(value: unknown): value is { kind: 'endOfChapter' } {
  return typeof value === 'object' && value !== null && (value as { kind?: string }).kind === 'endOfChapter';
}

function isMinutesSpec(value: unknown): value is { kind: 'minutes'; minutes: number } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { kind?: string; minutes?: unknown };
  if (v.kind !== 'minutes' || typeof v.minutes !== 'number') return false;
  const m = v.minutes;
  const presetOk = (SLEEP_PRESET_MINUTES as readonly number[]).includes(m);
  const customOk = m >= SLEEP_CUSTOM_MIN && m <= SLEEP_CUSTOM_MAX;
  return presetOk || customOk;
}

export function parseSleepTimerSpec(value: unknown): SleepTimerSpec | undefined {
  if (isEndOfChapter(value)) return { kind: 'endOfChapter' };
  if (isMinutesSpec(value)) return { kind: 'minutes', minutes: value.minutes };
  return undefined;
}

export async function loadLastSleepTimerSpec(db: PageNestDB): Promise<SleepTimerSpec | undefined> {
  const raw = await getSetting<unknown>(db, LAST_SLEEP_TIMER_KEY);
  return parseSleepTimerSpec(raw);
}

export async function persistLastSleepTimerSpec(db: PageNestDB, spec: SleepTimerSpec): Promise<void> {
  await setSetting(db, LAST_SLEEP_TIMER_KEY, spec);
}
