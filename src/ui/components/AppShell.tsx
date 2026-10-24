import { useEffect, useRef, type ReactNode } from 'react';
import { Rail, TabBar, type NavItem } from './navigation';

export interface AppShellProps {
  items: readonly NavItem[];
  value: string;
  onSelect: (id: string) => void;
  /** Rendered above the tab bar (phone) or at the bottom of the content area (tablet). */
  miniPlayer?: ReactNode;
  /** Rail header and footer slots (tablet and desktop). */
  railHeader?: ReactNode;
  railFooter?: ReactNode;
  children?: ReactNode;
}

/**
 * Responsive frame: left rail from 768 px, bottom tab bar below it, mini-player floating above
 * the tab bar on every screen. It publishes the height of the bottom chrome as
 * `--pn-bottom-chrome` on the document root so snackbars and content clear it.
 */
export function AppShell({ items, value, onSelect, miniPlayer, railHeader, railFooter, children }: AppShellProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bottomRef.current;
    const root = document.documentElement;
    if (!el) return undefined;
    const publish = () => root.style.setProperty('--pn-bottom-chrome', `${el.offsetHeight}px`);
    publish();
    if (typeof ResizeObserver === 'undefined') return () => root.style.removeProperty('--pn-bottom-chrome');
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--pn-bottom-chrome');
    };
  }, []);

  return (
    <div className="pn-shell">
      <Rail items={items} value={value} onSelect={onSelect} header={railHeader} footer={railFooter} />
      <main className="pn-shell__main">{children}</main>
      <div className="pn-shell__bottom" ref={bottomRef}>
        {miniPlayer}
        <TabBar items={items} value={value} onSelect={onSelect} />
      </div>
    </div>
  );
}
