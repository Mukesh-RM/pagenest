import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { FirstRunGate } from './onboarding/FirstRunGate';
import { OnboardingFallback, ScreenFallback } from './ScreenFallback';
import {
  CollectionsScreen,
  LibraryScreen,
  OnboardingScreen,
  SettingsScreen,
  StatsScreen,
  preloadScreens,
  preloadScreensWhenIdle,
} from './screens';

// Start the home screen's download now, in parallel with reading saved settings.
preloadScreens(['library']);

/**
 * Design-system demo page, development only. `import.meta.env.DEV` is a build-time constant, so
 * in production this whole expression (and the dynamic import) is removed and the demo is not
 * in the bundle.
 */
const UiKitDemo = import.meta.env.DEV ? lazy(() => import('@/ui/demo/UiKitDemo')) : null;

function screen(element: JSX.Element): JSX.Element {
  return <Suspense fallback={<ScreenFallback />}>{element}</Suspense>;
}

function AppScreens() {
  // When the browser is idle, fetch the other tabs so switching is instant (and works offline).
  useEffect(() => preloadScreensWhenIdle(['collections', 'stats', 'settings']), []);
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </FirstRunGate>
  );
}

/**
 * Route table. The four tabs sit behind first-run onboarding. `/ui-kit` (development only)
 * is outside it, so the demo opens straight away.
 */
export function AppRoutes() {
  return (
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
  );
}
