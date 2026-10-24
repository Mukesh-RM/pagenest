import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { FirstRunGate } from './onboarding/FirstRunGate';
import { CollectionsPage } from './pages/CollectionsPage';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';

/**
 * Design-system demo page, development only. `import.meta.env.DEV` is a build-time constant, so
 * in production this whole expression (and the dynamic import) is removed and the demo is not
 * in the bundle.
 */
const UiKitDemo = import.meta.env.DEV ? lazy(() => import('@/ui/demo/UiKitDemo')) : null;

function AppScreens() {
  return (
    <FirstRunGate>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<LibraryPage />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
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
