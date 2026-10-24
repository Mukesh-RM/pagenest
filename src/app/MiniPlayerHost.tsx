import type { MiniPlayerSlot } from '@/app/contracts';
import { useChromeStore } from './route-chrome';

export function MiniPlayerHost({ slot }: { slot: MiniPlayerSlot }) {
  const lazy = useChromeStore((s) => s.mp);
  const active = slot.useActive ? slot.useActive() : true;
  const Component = slot.Component ?? lazy;
  if (!active || !Component) return null;
  return (
    <div data-testid="mini-player-slot">
      <Component />
    </div>
  );
}
