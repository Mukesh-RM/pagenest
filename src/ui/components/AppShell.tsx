import { useEffect, useRef, type ReactNode } from 'react';
import { useMinWidth } from '../utils/media';
import { Rail, TabBar, type NavItem } from './navigation';

/** `full`: rail or tab bar around the content. `immersive`: content only (reader, full player). */
export type AppShellChrome = 'full' | 'immersive';

export interface AppShellProps {
  items: readonly NavItem[];
  value: string;
  onSelect: (id: string) => void;
  /**
   * Navigation chrome. Default `full`. `immersive` renders neither the rail nor the tab bar, so the content fills
   * the viewport (reader, full player). Switching is instant (no animation, so nothing to reduce) and the
   * safe-area insets are applied to the content area. The bottom chrome height is published as 0 again.
   */
  chrome?: AppShellChrome;
  /** Alias for `chrome="immersive"` when true. `chrome` wins if both are given. */
  hidden?: boolean;
  /**
   * Whether the mini-player slot is shown. Defaults to true with `full` chrome and false when immersive (the full
   * player is already on screen). Pass true to keep a docked mini-player on an immersive route.
   */
  showMiniPlayer?: boolean;
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
export function AppShell({
  items,
  value,
  onSelect,
  chrome: chromeProp,
  hidden = false,
  showMiniPlayer,
  miniPlayer,
  railHeader,
  railFooter,
  children,
}: AppShellProps) {
  const chrome: AppShellChrome = chromeProp ?? (hidden ? 'immersive' : 'full');
  const immersive = chrome === 'immersive';
  const miniVisible = showMiniPlayer ?? !immersive;
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
    <div className="pn-shell" data-chrome={chrome}>
      {wide && !immersive ? <Rail items={items} value={value} onSelect={onSelect} header={railHeader} footer={railFooter} /> : null}
      <main className="pn-shell__main">{children}</main>
      {/* Always rendered, so toggling chrome never remounts the content or moves it; empty it is 0 px tall. */}
      <div className="pn-shell__bottom" ref={bottomRef}>
        {miniVisible ? miniPlayer : null}
        {wide || immersive ? null : <TabBar items={items} value={value} onSelect={onSelect} />}
      </div>
    </div>
  );
}
