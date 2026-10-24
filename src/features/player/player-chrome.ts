/**
 * Main-path exports for the app shell: mini-player slot and playing flag only.
 * Do not import the audio engine or PlayerProvider from here.
 */
export { miniPlayerSlot } from './chrome-slot';
export { useIsPlaying, useMiniPlayerActive, useChromePlayerStore } from './chrome-store';
export { preloadPlayerEngine } from './lazy-runtime';
export { LazyPlayerRoot } from './LazyPlayerRoot';
