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

export interface EnginePlayerStore {
  readonly state: AudioState;
  setState(state: AudioState): void;
}

export const useEnginePlayerStore = create<EnginePlayerStore>((set) => ({
  state: idleState,
  setState: (state) => set({ state }),
}));
