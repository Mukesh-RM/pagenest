import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell as DesignAppShell } from '@/ui';
import { NAV_ITEMS, tabForPath } from './tabs';

/**
 * Router layout: the design system's responsive frame (bottom tab bar on phones, left rail from
 * 768 px, room above the tab bar for the mini-player) around the current screen. Tabs are real
 * links, so middle-click and long-press work; a plain tap navigates without a page load.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <DesignAppShell
      items={NAV_ITEMS}
      value={tabForPath(pathname)}
      onSelect={(id) => {
        const href = NAV_ITEMS.find((item) => item.id === id)?.href;
        if (href) navigate(href);
      }}
    >
      <div className="px-[var(--pn-margin)] pb-6 pt-[calc(1rem+var(--pn-safe-top))]">
        <Outlet />
      </div>
    </DesignAppShell>
  );
}
