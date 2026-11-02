import { type ComponentType } from 'react';
import { importModule } from '@/app/chunk-import';
import { lazyWithRetry } from '@/app/lazy-with-retry';

/**
 * Route-level code splitting. Each tab and onboarding is its own chunk, so the first paint only
 * downloads the shell, router, theme and settings code. Loaders are plain functions so the app
 * can start them early (see {@link preloadScreens}).
 */
const loaders = {
  library: () => import('./pages/LibraryRoute').then((m) => ({ default: m.LibraryRoute })),
  collections: () => import('./pages/CollectionsPage').then((m) => ({ default: m.CollectionsPage })),
  stats: () => import('./pages/StatsPage').then((m) => ({ default: m.StatsPage })),
  settings: () => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
  read: () => import('./pages/ReadRoute').then((m) => ({ default: m.ReadRoute })),
  listen: () => import('./pages/ListenRoute').then((m) => ({ default: m.ListenRoute })),
  onboarding: () => import('./onboarding/Onboarding').then((m) => ({ default: m.Onboarding })),
} satisfies Record<string, () => Promise<{ default: ComponentType }>>;

export type ScreenName = keyof typeof loaders;

export const LibraryScreen = lazyWithRetry(loaders.library);
export const CollectionsScreen = lazyWithRetry(loaders.collections);
export const StatsScreen = lazyWithRetry(loaders.stats);
export const SettingsScreen = lazyWithRetry(loaders.settings);
export const ReadScreen = lazyWithRetry(loaders.read);
export const ListenScreen = lazyWithRetry(loaders.listen);
export const OnboardingScreen = lazyWithRetry(loaders.onboarding);

/** Start downloading screens now. Safe to call many times: the browser and bundler cache the module. */
export function preloadScreens(names: readonly ScreenName[]): void {
  for (const name of names) void importModule(loaders[name]);
}

/**
 * Warm the screens the user is likely to open next, when the browser is idle, so tab switches
 * and first launch never wait on the network. `delayMs` keeps the downloads out of the first paint. Returns a cancel function.
 */
export function preloadScreensWhenIdle(names: readonly ScreenName[], delayMs = 0): () => void {
  let cancelIdle = (): void => {};
  const start = (): void => {
    const idle = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (typeof idle === 'function') {
      const handle = idle.call(window, () => preloadScreens(names), { timeout: 3000 });
      cancelIdle = () => (window as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
      return;
    }
    const timer = window.setTimeout(() => preloadScreens(names), 1500);
    cancelIdle = () => window.clearTimeout(timer);
  };
  if (delayMs <= 0) {
    start();
    return () => cancelIdle();
  }
  // Wait out the first paint first: these downloads are for the next tap, never for the first screen.
  const wait = window.setTimeout(start, delayMs);
  return () => {
    window.clearTimeout(wait);
    cancelIdle();
  };
}
