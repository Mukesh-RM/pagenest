import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@/ui';
import { createDataClient } from '@/data/data-client';
import { getDb } from '@/data/db';
import { DexieProgressService } from '@/data/progress-service';
import { ServicesProvider } from '@/app/services';
import { DEV_FIXTURE_BOOK_ID, ListenRoute, PlayerProvider } from '@/features/player';

const db = getDb();
const services = {
  db,
  progress: new DexieProgressService(db),
  data: createDataClient({ db }),
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <PlayerProvider>
        <MemoryRouter initialEntries={[`/listen/${DEV_FIXTURE_BOOK_ID}`]}>
          <Routes>
            <Route path="/listen/:id" element={<ListenRoute />} />
          </Routes>
        </MemoryRouter>
      </PlayerProvider>
    </ServicesProvider>
  </StrictMode>,
);
