import { createContext, useContext } from 'react';
import type { ProgressService } from '@/app/contracts';
import type { PageNestDB } from '@/data/db';

/** The long-lived objects screens need. Provided once at the app root. */
export interface AppServices {
  readonly db: PageNestDB;
  readonly progress: ProgressService;
}

export const ServicesContext = createContext<AppServices | undefined>(undefined);

export function useServices(): AppServices {
  const value = useContext(ServicesContext);
  if (!value) throw new Error('useServices must be used inside <ServicesProvider>.');
  return value;
}
