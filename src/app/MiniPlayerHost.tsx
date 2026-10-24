import { useSyncExternalStore, type ComponentType } from 'react';
import type { MiniPlayerSlot } from '@/app/contracts';
import { getMiniPlayerComponent, subscribeMiniPlayerReady } from './audio-mini-register';

const always = (): boolean => true;

function useMiniPlayerComponent(): ComponentType | null {
  return useSyncExternalStore(subscribeMiniPlayerReady, getMiniPlayerComponent, getMiniPlayerComponent);
}

function DefaultLazyMiniPlayer(): null | JSX.Element {
  const Player = useMiniPlayerComponent();
  return Player ? <Player /> : null;
}

/** Renders the registered mini-player above the tab bar when the slot is active. */
export function MiniPlayerHost({ slot }: { slot: MiniPlayerSlot }) {
  const useActive = slot.useActive ?? always;
  const active = useActive();
  if (!active) return null;
  const Component = slot.Component ?? DefaultLazyMiniPlayer;
  return (
    <div data-testid="mini-player-slot">
      <Component />
    </div>
  );
}
