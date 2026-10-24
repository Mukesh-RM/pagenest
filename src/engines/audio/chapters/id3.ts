import type { IChapter } from 'music-metadata';
import type { AudioChapter } from '../types';

/** Map music-metadata ID3 chapters (CHAP/CTOC) to book chapters. */
export function chaptersFromId3(chapters: IChapter[] | undefined): AudioChapter[] {
  if (!chapters?.length) return [];
  return chapters
    .map((ch, i) => ({
      index: i,
      title: ch.title?.trim() || `Chapter ${i + 1}`,
      startSec: ch.timeScale ? ch.start / ch.timeScale : ch.start,
    }))
    .sort((a, b) => a.startSec - b.startSec)
    .map((c, i) => ({ ...c, index: i }));
}
