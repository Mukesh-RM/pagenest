import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ServicesContext, type AppServices } from '@/app/services-context';
import { CoverUrlCache } from '@/data/cover-url';
import { createDataClient } from '@/data/data-client';
import { getDb } from '@/data/db';
import { DexieProgressService } from '@/data/progress-service';
import { ThemeProvider } from '@/ui';
import { BackupRestorePanel, CollectionsScreen, LibraryScreen, StoragePanel, createSampleBookProvider } from '../index';

/**
 * Test page for the Library: the real screens with the real data worker, import worker, OPFS and
 * IndexedDB, in the same frame as the app (a `main` with the shell's padding), but without the rest
 * of the app. Used only by the Playwright tests in this folder.
 */
const db = getDb();
const data = createDataClient({ db });
const services: AppServices = {
  db,
  progress: new DexieProgressService(db),
  data,
  covers: new CoverUrlCache({ load: (id) => data.books.getCover(id) }),
  sampleBook: createSampleBookProvider(),
};

const errors: string[] = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));
(window as unknown as { __errors: string[] }).__errors = errors;

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function Page() {
  const path = new URLSearchParams(window.location.search).get('screen') ?? 'library';
  return (
    <main className="pn-shell__main">
      <div style={{ padding: 'calc(1rem + env(safe-area-inset-top, 0px)) var(--pn-margin) 24px' }}>
        {path === 'settings' ? (
          <>
            <BackupRestorePanel />
            <StoragePanel />
          </>
        ) : (
          <Routes>
            <Route path="/" element={path === 'collections' ? <CollectionsScreen /> : <LibraryScreen />} />
            <Route path="*" element={<Where />} />
          </Routes>
        )}
      </div>
    </main>
  );
}

void db.open().then(() => {
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <ServicesContext.Provider value={services}>
        <ThemeProvider>
          <MemoryRouter>
            <Page />
          </MemoryRouter>
        </ThemeProvider>
      </ServicesContext.Provider>
    </StrictMode>,
  );
});
