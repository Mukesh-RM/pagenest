import { useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell as DesignAppShell } from '@/ui';
import { PwaPromptsHost } from './components/PwaPromptsHost';
import { MiniPlayerHost } from './MiniPlayerHost';
import { useCurrentChrome } from './route-chrome';
import { useServices } from './services-context';
import { NAV_ITEMS, tabForPath } from './tabs';

/**
 * Router layout for every screen. It always renders the design system's responsive frame (bottom
 * tab bar on phones, left rail from 768 px) so the screen underneath is never remounted. Which
 * chrome shows follows the route's chrome (`docs/ROUTE_CHROME.md`) and is passed to the frame's
 * `chrome` prop: the design system takes the rail, tab bar and mini-player out of the layout and
 * applies the safe-area insets itself on immersive routes.
 *
 * - `full` (the four tabs): tab bar or rail, mini-player when one is registered. Screens bring
 *   their own page padding (`pn-screen`); the frame only adds the top safe-area inset.
 * - `immersive` (reader, player): no navigation; the screen owns the whole window.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { miniPlayerSlot } = useServices();
  const chrome = useCurrentChrome();
  const onSelect = useCallback(
    (id: string) => {
      const href = NAV_ITEMS.find((item) => item.id === id)?.href;
      if (href) navigate(href);
    },
    [navigate],
  );
  const full = chrome === 'full';
  return (
    <DesignAppShell
      items={NAV_ITEMS}
      value={tabForPath(pathname)}
      onSelect={onSelect}
      chrome={chrome}
      miniPlayer={miniPlayerSlot ? <MiniPlayerHost slot={miniPlayerSlot} /> : null}
    >
      <div className={full ? 'pt-[var(--pn-safe-top)]' : undefined}>
        <Outlet />
      </div>
      <PwaPromptsHost />
    </DesignAppShell>
  );
}
