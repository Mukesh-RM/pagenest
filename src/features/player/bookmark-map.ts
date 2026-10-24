import type { BookmarkRecord } from '@/data/schema';
import type { AudioChapter, AudioItem } from '@/engines/audio/types';
import { bookPositionFromLocator, chapterIndexAt, locatorFromBookPosition } from '@/engines/audio/util';
import type { Locator } from '@/app/contracts';
import type { PlayerBookmark } from '@/ui/types';

export function bookmarkRecordToPlayer(record: BookmarkRecord, item: AudioItem): PlayerBookmark | null {
  if (record.locator.kind !== 'audio') return null;
  const track = item.tracks[record.locator.trackIndex];
  if (!track) return null;
  const positionSec = bookPositionFromLocator(item.tracks, record.locator);
  const chapterIdx = chapterIndexAt(item.chapters, positionSec);
  const chapterTitle = item.chapters[chapterIdx]?.title;
  const label = record.label.trim();
  return {
    id: record.id,
    positionSec,
    label: label.length > 0 ? label : undefined,
    chapter: chapterTitle,
  };
}

export function locatorFromBookPositionSec(item: AudioItem, bookPositionSec: number): Locator {
  return locatorFromBookPosition(item.tracks, bookPositionSec);
}

export function chapterTitleAt(chapters: readonly AudioChapter[], bookPositionSec: number): string | undefined {
  const idx = chapterIndexAt(chapters, bookPositionSec);
  return chapters[idx]?.title;
}
