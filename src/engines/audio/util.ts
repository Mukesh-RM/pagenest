import type { AudioLocator } from '@/app/contracts';
import type { AudioChapter, AudioTrack } from './types';

export const MIN_SPEED = 0.5;
export const MAX_SPEED = 3;

export const DEFAULT_AUDIO_OPTIONS = {
  skipBackSec: 15 as const,
  skipForwardSec: 30 as const,
  smartRewindSec: 5,
};

export function clampSpeed(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, rate));
}

/** Index of the chapter that contains `bookPositionSec`. */
export function chapterIndexAt(chapters: readonly AudioChapter[], bookPositionSec: number): number {
  if (chapters.length === 0) return -1;
  let idx = 0;
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    if (ch && ch.startSec <= bookPositionSec) idx = i;
  }
  return idx;
}

export function chapterAt(chapters: readonly AudioChapter[], bookPositionSec: number): AudioChapter | undefined {
  const index = chapterIndexAt(chapters, bookPositionSec);
  return index >= 0 ? chapters[index] : undefined;
}

/** Seconds left in the current chapter and book, adjusted for playback speed. */
export function remainingAt(
  bookPositionSec: number,
  durationSec: number,
  chapters: readonly AudioChapter[],
  speed: number,
): { chapterRemainingSec: number; bookRemainingSec: number } {
  const rate = clampSpeed(speed);
  const bookRemaining = Math.max(0, durationSec - bookPositionSec) / rate;
  const chapter = chapterAt(chapters, bookPositionSec);
  const nextChapter = chapter ? chapters[chapter.index + 1] : undefined;
  const chapterEnd = nextChapter ? nextChapter.startSec : durationSec;
  const chapterRemaining = Math.max(0, chapterEnd - bookPositionSec) / rate;
  return { chapterRemainingSec: chapterRemaining, bookRemainingSec: bookRemaining };
}

/** Find which track contains a book position and the offset inside that track. */
export function trackAtPosition(
  tracks: readonly AudioTrack[],
  bookPositionSec: number,
): { track: AudioTrack; offsetInTrackSec: number } | undefined {
  if (tracks.length === 0) return undefined;
  let chosen: AudioTrack = tracks[0]!;
  for (const t of tracks) {
    if (t.startOffsetSec <= bookPositionSec) chosen = t;
  }
  const offset = Math.max(0, bookPositionSec - chosen.startOffsetSec);
  return { track: chosen, offsetInTrackSec: offset };
}

export function bookPositionFromLocator(
  tracks: readonly AudioTrack[],
  locator: AudioLocator,
): number {
  const track = tracks[locator.trackIndex];
  if (!track) return 0;
  return track.startOffsetSec + locator.positionSec;
}

export function locatorFromBookPosition(
  tracks: readonly AudioTrack[],
  bookPositionSec: number,
): AudioLocator {
  const at = trackAtPosition(tracks, bookPositionSec);
  if (!at) return { kind: 'audio', trackIndex: 0, positionSec: 0 };
  return { kind: 'audio', trackIndex: at.track.index, positionSec: at.offsetInTrackSec };
}

export function percentFromPosition(bookPositionSec: number, durationSec: number): number {
  if (durationSec <= 0) return 0;
  return Math.min(100, Math.max(0, (bookPositionSec / durationSec) * 100));
}

export function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Natural sort for track file names (chapter 2 before chapter 10). */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
