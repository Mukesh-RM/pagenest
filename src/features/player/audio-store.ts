import { create } from 'zustand';
import type { AudioState } from '@/engines/audio/types';
import { DEFAULT_AUDIO_OPTIONS } from '@/engines/audio/util';

const idleState: AudioState = {
  status: 'idle',
  positionSec: 0,
  durationSec: 0,
  chapterIndex: -1,
  chapterRemainingSec: 0,
  bookRemainingSec: 0,
  speed: 1,
  options: { ...DEFAULT_AUDIO_OPTIONS },
};

export interface PlayerStore {
  readonly state: AudioState;
  readonly isPlaying: boolean;
  readonly fullPlayerOpen: boolean;
  setState(state: AudioState): void;
  setFullPlayerOpen(open: boolean): void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  state: idleState,
  isPlaying: false,
  fullPlayerOpen: false,
  setState: (state) => set({ state, isPlaying: state.status === 'playing' }),
  setFullPlayerOpen: (open) => set({ fullPlayerOpen: open }),
}));

/** For the PWA update prompt and any screen that must not interrupt playback. */
export function useIsPlaying(): boolean {
  return usePlayerStore((s) => s.isPlaying);
}

export function selectIsPlaying(): boolean {
  return usePlayerStore.getState().isPlaying;
}
