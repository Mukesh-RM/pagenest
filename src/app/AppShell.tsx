import { useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell as DesignAppShell } from '@/ui';
import { MiniPlayerHost } from './MiniPlayerHost';
import { useCurrentChrome } from './route-chrome';
import { useServices } from './services-context';
import { NAV_ITEMS, tabForPath } from './tabs';

/**
 * Router layout for every screen. It always renders the design system's responsive frame (bottom
 * tab bar on phones, left rail from 768 px) so the screen underneath is never remounted; whether
 * the tab bar, rail and mini-player are visible follows the route's chrome (`data-chrome`, see
 * `docs/ROUTE_CHROME.md`). Tabs are real links, so middle-click and long-press work.
 *
 * - `full` (the four tabs): padded content, tab bar or rail, mini-player when one is registered.
 * - `immersive` (reader, player): no padding and no chrome; the screen owns the whole window.
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
    <div data-chrome={chrome} className="pn-chrome-scope">
      <DesignAppShell
        items={NAV_ITEMS}
        value={tabForPath(pathname)}
        onSelect={onSelect}
        miniPlayer={full && miniPlayerSlot ? <MiniPlayerHost slot={miniPlayerSlot} /> : null}
      >
        <div className={full ? 'px-[var(--pn-margin)] pb-6 pt-[calc(1rem+var(--pn-safe-top))]' : undefined}>
          <Outlet />
        </div>
      </DesignAppShell>
    </div>
  );
}
