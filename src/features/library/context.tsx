import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { ImportController, ImportState } from './import-controller';

const ImportContext = createContext<ImportController | undefined>(undefined);

export function ImportProvider({ controller, children }: { controller: ImportController; children: ReactNode }) {
  return <ImportContext.Provider value={controller}>{children}</ImportContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hooks live next to their provider
export function useImportController(): ImportController {
  const value = useContext(ImportContext);
  if (!value) throw new Error('Library components must be inside <ImportProvider>.');
  return value;
}

/** Subscribe to a slice of the import state. */
// eslint-disable-next-line react-refresh/only-export-components -- hooks live next to their provider
export function useImportState<T>(selector: (state: ImportState) => T): T {
  return useStore(useImportController().store, selector);
}
