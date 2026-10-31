import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import '@/ui';
import { SnackbarProvider } from '@/ui';
import { AppShell } from '@/app/AppShell';
import { RouteChrome } from '@/app/RouteChrome';
import { CoverUrlCache } from '@/data/cover-url';
import { createDataClient } from '@/data/data-client';
import { getDb } from '@/data/db';
import { DexieProgressService } from '@/data/progress-service';
import { ServicesProvider } from '@/app/services';
import {
  AudiobookPlayerScreen,
  miniPlayerSlot,
  PlayerProvider,
} from '@/features/player';
import { ensureSeedAudiobookBookRecord, SEED_AUDIO_BOOK_ID } from '@/features/player/seed/seed-audiobook';
import type { BookRecord } from '@/data/schema';

const db = getDb();
const data = createDataClient({ db, workerFactory: () => undefined });
const services = {
  db,
  progress: new DexieProgressService(db),
  data,
  covers: new CoverUrlCache({ load: (id) => data.books.getCover(id) }),
  miniPlayerSlot,
};

void ensureSeedAudiobookBookRecord(db);
const fixtureBook: BookRecord = {
  id: SEED_AUDIO_BOOK_ID,
  fingerprint: 'pn-seed-audiobook-cc0',
  kind: 'audio',
  format: 'wav',
  title: 'The Extraordinarily Long Title Of A Synthetic Audiobook Used For Layout And Screenshot Review',
  addedAt: Date.now(),
  favorite: false,
  finished: false,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <SnackbarProvider>
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
      </SnackbarProvider>
    </ServicesProvider>
  </StrictMode>,
);
