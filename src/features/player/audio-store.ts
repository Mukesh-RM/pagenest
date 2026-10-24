/**
 * @deprecated Prefer `useEnginePlayerStore` (full player) or `useChromePlayerStore` / `useIsPlaying` (shell).
 * Kept for existing tests and lazy player modules.
 */
import { selectIsPlaying, useChromePlayerStore, useIsPlaying } from './chrome-store';
import { useEnginePlayerStore } from './engine-store';

export const usePlayerStore = useEnginePlayerStore;

export { useIsPlaying, selectIsPlaying };

export function selectMiniPlayerActive(): boolean {
  return useChromePlayerStore.getState().sessionActive;
}
