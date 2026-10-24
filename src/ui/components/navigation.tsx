import type { MouseEvent, ReactNode } from 'react';
import { Icon, type IconName } from '../icons';
import { cx } from '../utils/cx';

export interface NavItem {
  id: string;
  /** Visible label and accessible name. */
  label: string;
  icon: IconName;
  /** Optional real link (for React Router) so middle-click and long-press work. */
  href?: string;
}

/** The four phone tabs from blueprint 5.5. */
export const DEFAULT_NAV_ITEMS: readonly NavItem[] = [
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'collections', label: 'Collections', icon: 'collections' },
  { id: 'stats', label: 'Stats', icon: 'stats' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export interface NavigationProps {
  items: readonly NavItem[];
  /** Id of the current destination. */
  value: string;
  onSelect: (id: string) => void;
  /** Accessible name of the navigation landmark. */
  label?: string;
  className?: string;
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function NavList({ items, value, onSelect }: Pick<NavigationProps, 'items' | 'value' | 'onSelect'>) {
  return (
    <ul className="pn-nav__list">
      {items.map((item) => {
        const current = item.id === value;
        const content = (
          <>
            <Icon name={item.icon} />
            <span className="pn-nav__label">{item.label}</span>
          </>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <a
                href={item.href}
                className="pn-nav__item"
                aria-current={current ? 'page' : undefined}
                onClick={(event) => {
                  if (!isPlainLeftClick(event)) return;
                  event.preventDefault();
                  onSelect(item.id);
                }}
              >
                {content}
              </a>
            ) : (
              <button
                type="button"
                className="pn-nav__item"
                aria-current={current ? 'page' : undefined}
                onClick={() => onSelect(item.id)}
              >
                {content}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Phone bottom tab bar. Hidden from 768 px up, where the Rail takes over (pure CSS, so the
 * hidden one is also removed from the accessibility tree).
 */
export function TabBar({ items, value, onSelect, label = 'Main navigation', className }: NavigationProps) {
  return (
    <nav aria-label={label} className={cx('pn-tabbar', className)} data-testid="pn-tabbar">
      <NavList items={items} value={value} onSelect={onSelect} />
    </nav>
  );
}

export interface RailProps extends NavigationProps {
  /** Content above the destinations, for example the app mark. */
  header?: ReactNode;
  /** Content below the destinations, for example an Add button. */
  footer?: ReactNode;
}

/** Left rail for tablet and desktop (768 px and wider). Hidden on phones. */
export function Rail({ items, value, onSelect, label = 'Main navigation', header, footer, className }: RailProps) {
  return (
    <nav aria-label={label} className={cx('pn-rail', className)} data-testid="pn-rail">
      {header ? <div className="pn-rail__slot">{header}</div> : null}
      <NavList items={items} value={value} onSelect={onSelect} />
      {footer ? <div className="pn-rail__slot">{footer}</div> : null}
    </nav>
  );
}
