import type { MiniPlayerSlot } from '@/app/contracts';
import { ChromeMiniPlayer } from './chrome-mini-player';
import { useMiniPlayerActive } from './player-chrome';

/**
 * Lightweight mini-player slot for `AppServices` (no audio engine on the main path).
 */
export const miniPlayerSlot: MiniPlayerSlot = {
  Component: ChromeMiniPlayer,
  useActive: useMiniPlayerActive,
};
