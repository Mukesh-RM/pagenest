import type { PageNestDB } from '@/data/db';
import { getSetting, setSetting } from '@/data/settings';
import type { AudioOptions } from '@/engines/audio/types';

export const SKIP_SEC_KEYS = {
  skipBackSec: 'skipBackSec',
  skipForwardSec: 'skipForwardSec',
} as const;

const ALLOWED = new Set<number>([10, 15, 30, 60]);

export type SkipSec = AudioOptions['skipBackSec'];

export function parseSkipSec(value: unknown): SkipSec | undefined {
  return typeof value === 'number' && ALLOWED.has(value) ? (value as SkipSec) : undefined;
}

export async function loadAudioSkipOptions(db: PageNestDB): Promise<Partial<AudioOptions>> {
  const [back, forward] = await Promise.all([
    getSetting<number>(db, SKIP_SEC_KEYS.skipBackSec),
    getSetting<number>(db, SKIP_SEC_KEYS.skipForwardSec),
  ]);
  const partial: { skipBackSec?: SkipSec; skipForwardSec?: SkipSec } = {};
  const parsedBack = parseSkipSec(back);
  const parsedForward = parseSkipSec(forward);
  if (parsedBack !== undefined) partial.skipBackSec = parsedBack;
  if (parsedForward !== undefined) partial.skipForwardSec = parsedForward;
  return partial;
}

export async function persistSkipInterval(
  db: PageNestDB,
  direction: 'back' | 'forward',
  seconds: SkipSec,
): Promise<void> {
  const key = direction === 'back' ? SKIP_SEC_KEYS.skipBackSec : SKIP_SEC_KEYS.skipForwardSec;
  await setSetting(db, key, seconds);
}
