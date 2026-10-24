import type { MiniPlayerSlot } from '@/app/contracts';
import { AudioMiniPlayer } from './AudioMiniPlayer';
import { usePlayerStore } from './audio-store';

/** True when a book is loaded in the audio controller (frame reserves height only then). */
export function useMiniPlayerActive(): boolean {
  return usePlayerStore((s) => s.state.item !== undefined && s.state.status !== 'idle');
}

/**
 * Register on `AppServices.miniPlayerSlot`. Renders on `full` routes only; unmounts on immersive
 * routes without stopping playback (see `docs/ROUTE_CHROME.md`).
 */
export const miniPlayerSlot: MiniPlayerSlot = {
  Component: AudioMiniPlayer,
  useActive: useMiniPlayerActive,
};
