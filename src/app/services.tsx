import { useMemo, type ReactNode } from 'react';
import { getDb } from '@/data/db';
import { DexieProgressService } from '@/data/progress-service';
import { ServicesContext, type AppServices } from './services-context';

/** Provide services. Pass `services` in tests; the app uses the shared database. */
export function ServicesProvider({ services, children }: { services?: AppServices; children: ReactNode }) {
  const value = useMemo<AppServices>(() => {
    if (services) return services;
    const db = getDb();
    return { db, progress: new DexieProgressService(db) };
  }, [services]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}
