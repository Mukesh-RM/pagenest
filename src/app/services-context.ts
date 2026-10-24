import { createContext, useContext } from 'react';
import type { ProgressService, SampleBookProvider } from '@/app/contracts';
import type { DataClient } from '@/data/data-client';
import type { PageNestDB } from '@/data/db';

/** The long-lived objects screens need. Provided once at the app root. */
export interface AppServices {
  readonly db: PageNestDB;
  readonly progress: ProgressService;
  /** Heavy work (file I/O, hashing, stats) that runs in a Web Worker. */
  readonly data: DataClient;
  /**
   * Optional "try a sample book" source, implemented by the Library. Without it the Library shows
   * no sample card at all (see `SampleBookProvider`).
   */
  readonly sampleBook?: SampleBookProvider;
}

export const ServicesContext = createContext<AppServices | undefined>(undefined);

export function useServices(): AppServices {
  const value = useContext(ServicesContext);
  if (!value) throw new Error('useServices must be used inside <ServicesProvider>.');
  return value;
}
