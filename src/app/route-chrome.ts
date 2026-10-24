import { useLayoutEffect, useState } from 'react';
import { create } from 'zustand';
import type { RouteChrome } from '@/app/contracts';

/** Who asked for a chrome: the route definition (`route`) or a screen through the hook (`screen`). */
export type ChromeSource = 'route' | 'screen';

interface Entry {
  readonly chrome: RouteChrome;
  readonly source: ChromeSource;
  /** Render order: a component rendered later (deeper in the tree) has a higher number. */
  readonly order: number;
}

interface ChromeState {
  readonly entries: Readonly<Record<number, Entry>>;
  /** True while the audio owner reports an active listening session (mini-player gate + PWA prompts). */
  readonly audioSession: boolean;
}

export const useChromeStore = create<ChromeState>(() => ({
  entries: {},
  audioSession: false,
}));

export function publishAudioSession(sessionActive: boolean): void {
  useChromeStore.setState({ audioSession: sessionActive });
}

/** The chrome the frame must show now: screens beat route defaults, deeper beats shallower, none means `full`. */
export function resolveChrome(entries: Readonly<Record<number, Entry>>): RouteChrome {
  let best: Entry | undefined;
  for (const entry of Object.values(entries)) {
    if (
      !best ||
      (entry.source === 'screen' && best.source === 'route') ||
      (entry.source === best.source && entry.order > best.order)
    ) {
      best = entry;
    }
  }
  return best?.chrome ?? 'full';
}

let nextOrder = 0;

/**
 * Register a chrome for as long as the calling component is mounted. Used by `<RouteChrome>`
 * (the route definition) and by `useRouteChrome` (a screen); prefer those.
 *
 * Safe with React StrictMode (the mount, unmount, mount cycle leaves exactly one entry), with
 * nesting (the deepest screen wins, and leaving a deeper one restores the next), and with a
 * changing `chrome` value (the entry is updated in place).
 */
export function useChromeRegistration(chrome: RouteChrome, source: ChromeSource): void {
  // Assigned during the first render, and render order is parent first, so deeper components get larger numbers.
  const [order] = useState(() => (nextOrder += 1));
  // A layout effect, so the frame is corrected before the browser paints: no flash of the tab bar on an immersive route.
  useLayoutEffect(() => {
    useChromeStore.setState((s) => ({ entries: { ...s.entries, [order]: { chrome, source, order } } }));
    return () => {
      useChromeStore.setState((s) => {
        const rest = { ...s.entries };
        delete rest[order];
        return { entries: rest };
      });
    };
  }, [chrome, source, order]);
}

/**
 * A screen's say over the app frame. `useRouteChrome('immersive')` hides the tab bar, rail and
 * mini-player while the screen is mounted; leaving restores whatever was there before.
 * The route definition already sets a default (the reader and player routes are immersive), so
 * a screen only calls this to change that default.
 */
export function useRouteChrome(chrome: RouteChrome): void {
  useChromeRegistration(chrome, 'screen');
}

/**
 * The chrome currently in effect. Selector-based: a component using it re-renders only when
 * the answer (`'full'` or `'immersive'`) changes, not when entries come and go.
 */
export function useCurrentChrome(): RouteChrome {
  return useChromeStore((s) => resolveChrome(s.entries));
}

/** Test helper: forget every registration. */
export function resetRouteChromeForTests(): void {
  useChromeStore.setState({ entries: {}, audioSession: false });
}
