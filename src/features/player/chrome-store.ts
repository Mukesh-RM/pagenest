import { create } from 'zustand';

/** Mini-player and PWA prompt data only — no audio engine imports. */
export interface ChromePlayerSnapshot {
  readonly bookId: string | null;
  readonly title: string;
  readonly subtitle: string;
  readonly coverUrl?: string;
  readonly playing: boolean;
  readonly positionSec: number;
  readonly durationSec: number;
  readonly skipBackSec: number;
}

const empty: ChromePlayerSnapshot = {
  bookId: null,
  title: '',
  subtitle: '',
  playing: false,
  positionSec: 0,
  durationSec: 0,
  skipBackSec: 15,
};

export interface ChromePlayerStore {
  readonly chrome: ChromePlayerSnapshot;
  /** True when a session is loaded (mini-player slot reserves space). */
  readonly sessionActive: boolean;
  setChrome(chrome: ChromePlayerSnapshot, sessionActive: boolean): void;
  clear(): void;
}

export const useChromePlayerStore = create<ChromePlayerStore>((set) => ({
  chrome: empty,
  sessionActive: false,
  setChrome: (chrome, sessionActive) => set({ chrome, sessionActive }),
  clear: () => set({ chrome: empty, sessionActive: false }),
}));

export function useIsPlaying(): boolean {
  return useChromePlayerStore((s) => s.chrome.playing);
}

export function selectIsPlaying(): boolean {
  return useChromePlayerStore.getState().chrome.playing;
}

export function useMiniPlayerActive(): boolean {
  return useChromePlayerStore((s) => s.sessionActive);
}
