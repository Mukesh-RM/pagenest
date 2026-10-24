import { lazy, type ComponentType } from 'react';

/**
 * Route-level code splitting. Each tab and onboarding is its own chunk, so the first paint only
 * downloads the shell, router, theme and settings code. Loaders are plain functions so the app
 * can start them early (see {@link preloadScreens}).
 */
const loaders = {
  library: () => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })),
  collections: () => import('./pages/CollectionsPage').then((m) => ({ default: m.CollectionsPage })),
  stats: () => import('./pages/StatsPage').then((m) => ({ default: m.StatsPage })),
  settings: () => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
  onboarding: () => import('./onboarding/Onboarding').then((m) => ({ default: m.Onboarding })),
} satisfies Record<string, () => Promise<{ default: ComponentType }>>;

export type ScreenName = keyof typeof loaders;

export const LibraryScreen = lazy(loaders.library);
export const CollectionsScreen = lazy(loaders.collections);
export const StatsScreen = lazy(loaders.stats);
export const SettingsScreen = lazy(loaders.settings);
export const OnboardingScreen = lazy(loaders.onboarding);

/** Start downloading screens now. Safe to call many times: the browser and bundler cache the module. */
export function preloadScreens(names: readonly ScreenName[]): void {
  for (const name of names) void loaders[name]();
}

/**
 * Warm the screens the user is likely to open next, when the browser is idle, so tab switches
 * and first launch never wait on the network. Returns a cancel function.
 */
export function preloadScreensWhenIdle(names: readonly ScreenName[]): () => void {
  const idle = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof idle === 'function') {
    const handle = idle.call(window, () => preloadScreens(names), { timeout: 3000 });
    return () => (window as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
  }
  const timer = window.setTimeout(() => preloadScreens(names), 1500);
  return () => window.clearTimeout(timer);
}
