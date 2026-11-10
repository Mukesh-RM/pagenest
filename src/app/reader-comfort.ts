import { getSetting, setSetting } from '@/data/settings';
import type { PageNestDB } from '@/data/db';

/** Edge-swipe brightness (0.4–1) and warm night filter (0–1), persisted across sessions. */
export interface ReaderComfort {
  readonly brightness: number;
  readonly warmth: number;
}

export const DEFAULT_READER_COMFORT: ReaderComfort = { brightness: 1, warmth: 0 };

export const READER_COMFORT_KEY = 'readerComfort';

export function parseReaderComfort(value: unknown): ReaderComfort {
  if (typeof value !== 'object' || value === null) return DEFAULT_READER_COMFORT;
  const v = value as Record<string, unknown>;
  const brightness =
    typeof v.brightness === 'number' && Number.isFinite(v.brightness)
      ? Math.min(1, Math.max(0.4, v.brightness))
      : DEFAULT_READER_COMFORT.brightness;
  const warmth =
    typeof v.warmth === 'number' && Number.isFinite(v.warmth) ? Math.min(1, Math.max(0, v.warmth)) : DEFAULT_READER_COMFORT.warmth;
  return { brightness, warmth };
}

export async function loadReaderComfort(db: PageNestDB): Promise<ReaderComfort> {
  const saved = await getSetting<unknown>(db, READER_COMFORT_KEY).catch(() => undefined);
  return saved === undefined ? DEFAULT_READER_COMFORT : parseReaderComfort(saved);
}

export async function saveReaderComfort(db: PageNestDB, comfort: ReaderComfort): Promise<void> {
  try {
    await setSetting(db, READER_COMFORT_KEY, comfort);
  } catch {
    // Storage blocked: comfort still applies this visit.
  }
}
