/**
 * Main-path exports for the app shell: mini-player slot and playing flag only.
 * Do not import the audio engine or PlayerProvider from here.
 */
export { miniPlayerSlot } from './chrome-slot';
import { useChromePlayerStore } from './chrome-store';

export function useIsPlaying(): boolean {
  return useChromePlayerStore((s) => s.sessionActive);
}

export function useMiniPlayerActive(): boolean {
  return useIsPlaying();
}

export { useChromePlayerStore } from './chrome-store';
export { preloadPlayerEngine } from './lazy-runtime';
export { LazyPlayerRoot } from './LazyPlayerRoot';
