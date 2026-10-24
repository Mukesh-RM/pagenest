import { autoColumns } from '../utils/virtual';
import { BREAKPOINTS, useMediaQuery } from '../utils/media';
import type { LibraryView } from './LibraryScreen';

/** Grid sizes in px that mirror the CSS of `.pn-library__grid` (styles/screens.css), so a windowed grid looks identical to a plain one. */
export interface LibraryGridSpec {
  /** Smallest card width in rem. */
  minRem: number;
  /** Space between columns and between rows in px (--pn-space tokens). */
  gap: number;
  rowGap: number;
  /** Largest number of columns; 1 for a phone list. */
  maxColumns: number;
  /** Fixed number of columns for the list view. */
  fixedColumns?: number;
}

export function libraryGridSpec(view: LibraryView, width: number): LibraryGridSpec {
  if (view === 'list') return { minRem: 0, gap: 12, rowGap: 12, maxColumns: 2, fixedColumns: width >= BREAKPOINTS.laptop ? 2 : 1 };
  if (width >= BREAKPOINTS.wide) return { minRem: 12, gap: 24, rowGap: 40, maxColumns: Infinity };
  if (width >= BREAKPOINTS.laptop) return { minRem: 11, gap: 20, rowGap: 32, maxColumns: Infinity };
  if (width >= BREAKPOINTS.tablet) return { minRem: 10, gap: 20, rowGap: 32, maxColumns: Infinity };
  return { minRem: 9, gap: 16, rowGap: 24, maxColumns: Infinity };
}

/** Columns for a list of `width` px: the same auto-fill count the CSS grid would pick. */
export function libraryColumns(spec: LibraryGridSpec, width: number, remPx: number): number {
  if (spec.fixedColumns) return spec.fixedColumns;
  return autoColumns(width, spec.minRem * remPx, spec.gap, spec.maxColumns);
}

function rootRemPx(): number {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return 16;
  return Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
}

/**
 * Grid sizes for a Library list, for `VirtualList`: `useLibraryGrid(view)` returns `{ spec, columns }`.
 * `spec.gap` and `spec.rowGap` (px) go to `VirtualList`'s `gap` and `rowGap`; `columns` (a function of the list width in px)
 * goes to its `columns`. They follow the same breakpoints and minimum card widths as `.pn-library__grid` in the CSS
 * (9, 10, 11, 12 rem; the list view is one column, two from 1024 px), re-render on a breakpoint change, and read the
 * root font size on every call, so 200% text size gives fewer, wider columns exactly like the CSS grid.
 *
 *     const grid = useLibraryGrid(view);
 *     <VirtualList items={books} columns={grid.columns} gap={grid.spec.gap} rowGap={grid.spec.rowGap} ... />
 */
export function useLibraryGrid(view: LibraryView): { spec: LibraryGridSpec; columns: (width: number) => number } {
  const tablet = useMediaQuery(`(min-width: ${BREAKPOINTS.tablet}px)`);
  const laptop = useMediaQuery(`(min-width: ${BREAKPOINTS.laptop}px)`);
  const wide = useMediaQuery(`(min-width: ${BREAKPOINTS.wide}px)`);
  const width = wide ? BREAKPOINTS.wide : laptop ? BREAKPOINTS.laptop : tablet ? BREAKPOINTS.tablet : 0;
  const spec = libraryGridSpec(view, width);
  return { spec, columns: (w: number) => libraryColumns(spec, w, rootRemPx()) };
}
