import type { EntityId } from '@/app/contracts';
import type { AudioChapter, AudioItem, AudioTrack } from './types';
import { evenChapters } from './chapters/even';
import { naturalCompare } from './util';

export interface FolderTrackInput {
  readonly blob: Blob;
  readonly fileName: string;
  readonly durationSec: number;
  readonly trackNumber?: number;
}

/** Build an {@link AudioItem} from a folder of MP3 files (one file per chapter when untagged). */
export function audioItemFromFolder(
  bookId: EntityId,
  title: string,
  files: readonly FolderTrackInput[],
  chapters: readonly AudioChapter[],
  meta?: { author?: string; narrator?: string; cover?: Blob },
): AudioItem {
  const ordered = [...files].sort((a, b) => {
    const ta = a.trackNumber ?? Number.MAX_SAFE_INTEGER;
    const tb = b.trackNumber ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return naturalCompare(a.fileName, b.fileName);
  });
  let offset = 0;
  const tracks: AudioTrack[] = ordered.map((f, index) => {
    const track: AudioTrack = {
      index,
      title: f.fileName.replace(/\.[^.]+$/, ''),
      durationSec: f.durationSec,
      startOffsetSec: offset,
      open: async () => f.blob,
    };
    offset += f.durationSec;
    return track;
  });
  const durationSec = offset;
  const resolvedChapters =
    chapters.length > 0
      ? chapters
      : tracks.map((t, i) => ({ index: i, title: t.title, startSec: t.startOffsetSec }));
  if (resolvedChapters.length === 0 && durationSec > 0) {
    return {
      bookId,
      title,
      ...meta,
      tracks,
      chapters: evenChapters(durationSec),
    };
  }
  return { bookId, title, ...meta, tracks, chapters: resolvedChapters };
}

export function audioItemFromSingleFile(
  bookId: EntityId,
  title: string,
  open: () => Promise<Blob>,
  durationSec: number,
  chapters: readonly AudioChapter[],
  meta?: { author?: string; narrator?: string; cover?: Blob },
): AudioItem {
  const tracks: AudioTrack[] = [
    { index: 0, title, durationSec, startOffsetSec: 0, open },
  ];
  const ch =
    chapters.length > 0 ? chapters : durationSec > 0 ? evenChapters(durationSec) : [];
  return { bookId, title, ...meta, tracks, chapters: ch };
}
