import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SnackbarProvider } from '@/ui';
import { AppShell } from './AppShell';
import { isReturningDevice } from './first-run-hint';
import { FirstRunGate } from './onboarding/FirstRunGate';
import { RouteChrome } from './RouteChrome';
import { LISTEN_ROUTE, READ_ROUTE } from './route-paths';
import { ImmersiveFallback, OnboardingFallback, ScreenFallback } from './ScreenFallback';
import {
  CollectionsScreen,
  LibraryScreen,
  ListenScreen,
  OnboardingScreen,
  ReadScreen,
  SettingsScreen,
  StatsScreen,
  preloadScreens,
  preloadScreensWhenIdle,
} from './screens';

// Start the first screen's download now, in parallel with reading saved settings.
preloadScreens([isReturningDevice() ? 'library' : 'onboarding']);

/** How long after start the other tabs are fetched: past the first paint of the first screen. */
const TAB_PRELOAD_DELAY_MS = 2000;

/**
 * Design-system demo page, development only. `import.meta.env.DEV` is a build-time constant, so
 * in production this whole expression (and the dynamic import) is removed and the demo is not
 * in the bundle.
 */
const UiKitDemo = import.meta.env.DEV ? lazy(() => import('@/ui/demo/UiKitDemo')) : null;

function screen(element: JSX.Element, fallback: JSX.Element = <ScreenFallback />): JSX.Element {
  return <Suspense fallback={fallback}>{element}</Suspense>;
}

function AppScreens() {
  // When the browser is idle, fetch the other tabs so switching is instant (and works offline).
  useEffect(() => preloadScreensWhenIdle(['library', 'collections', 'stats', 'settings'], TAB_PRELOAD_DELAY_MS), []);
  return (
    <FirstRunGate
      onboarding={
        <Suspense fallback={<OnboardingFallback />}>
          <OnboardingScreen />
        </Suspense>
      }
    >
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={screen(<LibraryScreen />)} />
          <Route path="collections" element={screen(<CollectionsScreen />)} />
          <Route path="stats" element={screen(<StatsScreen />)} />
          <Route path="settings" element={screen(<SettingsScreen />)} />
          {/* Book screens are immersive by default; a screen can override it with useRouteChrome (docs/ROUTE_CHROME.md). */}
          <Route
            path={READ_ROUTE}
            element={<RouteChrome chrome="immersive">{screen(<ReadScreen />, <ImmersiveFallback />)}</RouteChrome>}
          />
          <Route
            path={LISTEN_ROUTE}
            element={<RouteChrome chrome="immersive">{screen(<ListenScreen />, <ImmersiveFallback />)}</RouteChrome>}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </FirstRunGate>
  );
}

/**
 * Route table, inside the snackbar host ("Removed. Undo", "Added to your library"). The four tabs sit behind first-run onboarding. `/ui-kit` (development only)
 * is outside it, so the demo opens straight away.
 */
export function AppRoutes() {
  return (
    <SnackbarProvider>
      <Routes>
        {UiKitDemo ? (
          <Route
            path="ui-kit"
            element={
              <Suspense fallback={null}>
                <UiKitDemo />
              </Suspense>
            }
          />
        ) : null}
        <Route path="*" element={<AppScreens />} />
      </Routes>
    </SnackbarProvider>
  );
}
