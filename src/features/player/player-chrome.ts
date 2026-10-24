/**
 * Main-path exports for the app shell: mini-player slot and playing flag only.
 * Do not import the audio engine or PlayerProvider from here.
 */
export { miniPlayerSlot } from './chrome-slot';
import { useChromeStore } from '@/app/route-chrome';

export function useIsPlaying(): boolean {
  return useChromeStore((s) => s.audioSession);
}

export function useMiniPlayerActive(): boolean {
  return useChromeStore((s) => s.audioSession);
}
export { useChromePlayerStore } from './chrome-store';
export { preloadPlayerEngine } from './lazy-runtime';
export { LazyPlayerRoot } from './LazyPlayerRoot';
