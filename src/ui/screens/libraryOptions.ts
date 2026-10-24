/** Default filter and sort choices for LibraryScreen. A plain module so the screen file only exports components. */
export interface LibraryFilterOption {
  id: string;
  label: string;
}

export const DEFAULT_LIBRARY_FILTERS: readonly LibraryFilterOption[] = [
  { id: 'all', label: 'All' },
  { id: 'reading', label: 'Reading' },
  { id: 'listening', label: 'Listening' },
  { id: 'finished', label: 'Finished' },
];

export interface LibrarySortOption {
  id: string;
  label: string;
}

export const DEFAULT_LIBRARY_SORTS: readonly LibrarySortOption[] = [
  { id: 'recent', label: 'Recently opened' },
  { id: 'added', label: 'Recently added' },
  { id: 'title', label: 'Title' },
  { id: 'author', label: 'Author' },
];
