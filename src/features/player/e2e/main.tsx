import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import '@/ui';
import { AppShell } from '@/app/AppShell';
import { RouteChrome } from '@/app/RouteChrome';
import { createDataClient } from '@/data/data-client';
import { getDb } from '@/data/db';
import { DexieProgressService } from '@/data/progress-service';
import { ServicesProvider } from '@/app/services';
import {
  AudiobookPlayerScreen,
  DEV_FIXTURE_BOOK_ID,
  miniPlayerSlot,
  PlayerProvider,
} from '@/features/player';
import type { BookRecord } from '@/data/schema';

const db = getDb();
const services = {
  db,
  progress: new DexieProgressService(db),
  data: createDataClient({ db, workerFactory: () => undefined }),
  miniPlayerSlot,
};

const fixtureBook: BookRecord = {
  id: DEV_FIXTURE_BOOK_ID,
  fingerprint: 'dev-fixture',
  kind: 'audio',
  format: 'wav',
  title: 'PageNest test tone',
  addedAt: Date.now(),
  favorite: false,
  finished: false,
};

void db.books.put(fixtureBook);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <PlayerProvider>
        <HashRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<p>Library placeholder</p>} />
              <Route
                path="/listen/:id"
                element={
                  <RouteChrome chrome="immersive">
                    <AudiobookPlayerScreen book={fixtureBook} position={undefined} />
                  </RouteChrome>
                }
              />
            </Route>
          </Routes>
        </HashRouter>
      </PlayerProvider>
    </ServicesProvider>
  </StrictMode>,
);
