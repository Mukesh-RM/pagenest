import type { AudioChapter } from '../types';

interface Mp4BoxChapter {
  start: number;
  end: number;
  title?: string;
}

/**
 * Extract chapter list from mp4box chapter track (times in seconds).
 * Caller runs mp4box in a worker and passes normalized chapters.
 */
export function chaptersFromMp4Box(raw: readonly Mp4BoxChapter[]): AudioChapter[] {
  return raw
    .map((ch, i) => ({
      index: i,
      title: ch.title?.trim() || `Chapter ${i + 1}`,
      startSec: ch.start,
    }))
    .sort((a, b) => a.startSec - b.startSec)
    .map((c, i) => ({ ...c, index: i }));
}
