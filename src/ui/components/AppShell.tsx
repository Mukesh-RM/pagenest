import { useEffect, useRef, type ReactNode } from 'react';
import { useMinWidth } from '../utils/media';
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
 * Responsive frame: left rail from 768 px, bottom tab bar below it (only one of the two is in the DOM), mini-player floating above
 * the tab bar on every screen. It publishes the height of the bottom chrome as
 * `--pn-bottom-chrome` on the document root so snackbars and content clear it.
 */
export function AppShell({ items, value, onSelect, miniPlayer, railHeader, railFooter, children }: AppShellProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Only one navigation is rendered per breakpoint (the other would be a hidden duplicate in the DOM).
  const wide = useMinWidth('tablet');

  useEffect(() => {
    const el = bottomRef.current;
    const root = document.documentElement;
    if (!el) return undefined;
    let frame = 0;
    let last = -1;
    const write = (height: number) => {
      const rounded = Math.round(height);
      if (rounded === last) return;
      last = rounded;
      root.style.setProperty('--pn-bottom-chrome', `${rounded}px`);
    };
    // One measurement up front, then ResizeObserver sizes (no layout read), batched to one write per frame.
    write(el.getBoundingClientRect().height);
    if (typeof ResizeObserver === 'undefined') return () => root.style.removeProperty('--pn-bottom-chrome');
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      const size = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => write(size));
    });
    observer.observe(el, { box: 'border-box' });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      root.style.removeProperty('--pn-bottom-chrome');
    };
  }, []);

  return (
    <div className="pn-shell">
      {wide ? <Rail items={items} value={value} onSelect={onSelect} header={railHeader} footer={railFooter} /> : null}
      <main className="pn-shell__main">{children}</main>
      <div className="pn-shell__bottom" ref={bottomRef}>
        {miniPlayer}
        {wide ? null : <TabBar items={items} value={value} onSelect={onSelect} />}
      </div>
    </div>
  );
}
