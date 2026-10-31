import { useMemo, type ReactNode } from 'react';
import { CoverUrlCache } from '@/data/cover-url';
import { createDataClient } from '@/data/data-client';
import { getDb } from '@/data/db';
import { storageBootstrap } from './storage-bootstrap-state';
import { DexieProgressService } from '@/data/progress-service';
import { createLibraryProvider } from '@/features/library/provider';
import { useChromeStore } from './route-chrome';
import { ServicesContext, type AppServices } from './services-context';

/** Provide services. Pass `services` in tests; the app uses the shared database. */
export function ServicesProvider({ services, children }: { services?: AppServices; children: ReactNode }) {
  const value = useMemo<AppServices>(() => {
    if (services) return services;
    const db = getDb();
    const boot = storageBootstrap();
    const data = createDataClient({ db, ...boot?.dataClient });
    const base: AppServices = { db, progress: new DexieProgressService(db), data, covers: new CoverUrlCache({ load: (id) => data.books.getCover(id) }) };
    // One Library object is both the file importer and the sample-book source (docs/IMPORTER_CONTRACT.md).
    const library = createLibraryProvider();
    return { ...base, importer: library, sampleBook: library, miniPlayerSlot: { useActive: () => useChromeStore((s) => s.as) } };
  }, [services]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}
