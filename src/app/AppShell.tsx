import { NavLink, Outlet } from 'react-router-dom';
import { TABS } from './tabs';

/**
 * Phone: content above a bottom tab bar. Tablet and desktop (md and up): a left rail.
 * Tabs are 44 px or larger and respect the safe area for the home bar.
 */
export function AppShell() {
  return (
    <div className="flex h-full flex-col md:flex-row-reverse">
      <main id="main" className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-[calc(1rem+var(--pn-safe-top))] md:px-6">
        <Outlet />
      </main>
      <nav
        aria-label="Main"
        className="flex shrink-0 border-t border-line bg-surface pb-[var(--pn-safe-bottom)] md:w-24 md:flex-col md:justify-start md:gap-1 md:border-r md:border-t-0 md:pt-[var(--pn-safe-top)]"
      >
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium md:flex-none md:py-3 ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
