import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { LibraryController, LibraryState } from './controller';

const LibraryContext = createContext<LibraryController | undefined>(undefined);

export function LibraryProvider({ controller, children }: { controller: LibraryController; children: ReactNode }) {
  return <LibraryContext.Provider value={controller}>{children}</LibraryContext.Provider>;
}

export function useController(): LibraryController {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('Library components must be inside <LibraryProvider>.');
  return value;
}

/** Subscribe to a slice of the library state. Always pass a selector that returns a stable value. */
export function useLibraryState<T>(selector: (state: LibraryState) => T): T {
  return useStore(useController().store, selector);
}
