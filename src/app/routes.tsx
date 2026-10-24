import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { FirstRunGate } from './onboarding/FirstRunGate';
import { CollectionsPage } from './pages/CollectionsPage';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';

/** Route table for the four tabs. Unknown addresses go back to the Library. */
export function AppRoutes() {
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
