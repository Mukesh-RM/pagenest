import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ReaderFallback } from '@/features/reader/ReaderFallback';
import { AppShell } from './AppShell';
import { CollectionsPage } from './pages/CollectionsPage';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';

// The reader (pdf.js, foliate-js, mammoth) is a separate chunk, fetched when a book opens.
const ReaderRoute = lazy(() => import('@/features/reader/ReaderRoute'));
// Development only: adds the public-domain fixtures to the library. `import.meta.env.DEV` is replaced at build time,
// so this loader and the fixture files are not in production builds.
const DevFixtures = import.meta.env.DEV ? lazy(() => import('@/features/reader/dev/FixtureLoader')) : undefined;

/** Route table for the four tabs. Unknown addresses go back to the Library. */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="read/:id"
        element={
          <Suspense fallback={<ReaderFallback />}>
            <ReaderRoute />
          </Suspense>
        }
      />
      {DevFixtures ? (
        <Route
          path="dev/reader"
          element={
            <Suspense fallback={<ReaderFallback />}>
              <DevFixtures />
            </Suspense>
          }
        />
      ) : null}
      <Route element={<AppShell />}>
        <Route index element={<LibraryPage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
