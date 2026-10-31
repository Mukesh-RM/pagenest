import type { AudioState } from '@/engines/audio/types';
import { selectIsPlaying, usePlayerStore } from './audio-store';

/** Playback fields that must survive mini-player unmount on immersive routes. */
export interface PlaybackSnapshot {
  readonly isPlaying: boolean;
  readonly positionSec: number;
  readonly speed: number;
  readonly chapterIndex: number;
  readonly sleepMinutes: number | undefined;
  readonly sleepEndOfChapter: boolean;
}

export function snapshotFromState(state: AudioState, isPlaying: boolean): PlaybackSnapshot {
  const sleep = state.sleep?.spec;
  return {
    isPlaying,
    positionSec: state.positionSec,
    speed: state.speed,
    chapterIndex: state.chapterIndex,
    sleepMinutes: sleep?.kind === 'minutes' ? sleep.minutes : undefined,
    sleepEndOfChapter: sleep?.kind === 'endOfChapter',
  };
}

export function snapshotPlayback(): PlaybackSnapshot {
  const state = usePlayerStore.getState().state;
  return snapshotFromState(state, selectIsPlaying());
}

export function snapshotsEqual(a: PlaybackSnapshot, b: PlaybackSnapshot): boolean {
  return (
    a.isPlaying === b.isPlaying &&
    Math.abs(a.positionSec - b.positionSec) < 0.05 &&
    a.speed === b.speed &&
    a.chapterIndex === b.chapterIndex &&
    a.sleepMinutes === b.sleepMinutes &&
    a.sleepEndOfChapter === b.sleepEndOfChapter
  );
}
