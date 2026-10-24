import { useMemo, type ReactNode } from 'react';
import { CoverUrlCache } from '@/data/cover-url';
import { createDataClient } from '@/data/data-client';
import { getDb } from '@/data/db';
import { DexieProgressService } from '@/data/progress-service';
import { createLibraryProvider } from '@/features/library/provider';
import type { MiniPlayerSlot } from './contracts';
import { useChromeStore } from './route-chrome';
import { ServicesContext, type AppServices } from './services-context';

function useAudioSessionActive(): boolean {
  return useChromeStore((s) => s.audioSession);
}

const audioMiniPlayerSlot: MiniPlayerSlot = { useActive: useAudioSessionActive };

/** Provide services. Pass `services` in tests; the app uses the shared database. */
export function ServicesProvider({ services, children }: { services?: AppServices; children: ReactNode }) {
  const value = useMemo<AppServices>(() => {
    if (services) return services;
    const db = getDb();
    const data = createDataClient({ db });
    const base: AppServices = { db, progress: new DexieProgressService(db), data, covers: new CoverUrlCache({ load: (id) => data.books.getCover(id) }) };
    // One Library object is both the file importer and the sample-book source (docs/IMPORTER_CONTRACT.md).
    const library = createLibraryProvider();
    return { ...base, importer: library, sampleBook: library, miniPlayerSlot: audioMiniPlayerSlot };
  }, [services]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}
