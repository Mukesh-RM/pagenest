/**
 * @deprecated Prefer `useEnginePlayerStore` (full player) or `useChromePlayerStore` / `useIsPlaying` (shell).
 * Kept for existing tests and lazy player modules.
 */
import { useIsPlaying } from './player-chrome';
import { useChromePlayerStore } from './chrome-store';
import { useEnginePlayerStore } from './engine-store';

export const usePlayerStore = useEnginePlayerStore;

export { useIsPlaying };

export function selectIsPlaying(): boolean {
  return useChromePlayerStore.getState().chrome.playing;
}

export function selectMiniPlayerActive(): boolean {
  return useChromePlayerStore.getState().sessionActive;
}
