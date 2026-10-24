import type { MiniPlayerSlot } from '@/app/contracts';

const always = (): boolean => true;

/**
 * Renders the registered mini-player above the tab bar. The wrapper has the mini-player's height
 * (design token `--pn-miniplayer-height` plus its bottom margin), so the frame does not jump
 * while the component starts up. Rendered only when a slot is registered and active; with no
 * slot, or an inactive one, there is no element and no reserved space.
 */
export function MiniPlayerHost({ slot }: { slot: MiniPlayerSlot }) {
  const useActive = slot.useActive ?? always;
  const active = useActive();
  if (!active) return null;
  const { Component } = slot;
  return (
    <div data-testid="mini-player-slot" className="min-h-[calc(var(--pn-miniplayer-height)+var(--pn-space-2))]">
      <Component />
    </div>
  );
}
