import type { AudioChapter } from '../types';

/** Evenly spaced chapter markers when a book has none (blueprint 8.2). */
export function evenChapters(durationSec: number, count = 8): AudioChapter[] {
  if (durationSec <= 0 || count < 1) return [];
  const step = durationSec / count;
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    title: `Part ${i + 1}`,
    startSec: i * step,
  }));
}
