import { useCallback, useSyncExternalStore } from 'react';

/** Breakpoints in px (min-width), shared with the CSS media queries in styles/screens.css. */
export const BREAKPOINTS = { tablet: 768, laptop: 1024, wide: 1440 } as const;
export type Breakpoint = keyof typeof BREAKPOINTS;

export const minWidthQuery = (name: Breakpoint): string => `(min-width: ${BREAKPOINTS[name]}px)`;

function canMatch(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

/**
 * Subscribe to a media query. Reads the real value synchronously on the first render (useSyncExternalStore),
 * so a laptop never paints the phone layout first. Without matchMedia (tests, SSR) it reports `fallback`.
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!canMatch()) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => (canMatch() ? window.matchMedia(query).matches : fallback), [query, fallback]);
  return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}

/** True from the given breakpoint up. */
export function useMinWidth(name: Breakpoint): boolean {
  return useMediaQuery(minWidthQuery(name));
}
