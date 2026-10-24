/**
 * Pure geometry for windowed lists and grids. No DOM, no React: the VirtualList component calls these, and they are
 * unit tested on their own. A "row" is one line of the list (one item) or of the grid (`columns` items).
 */

/** How many columns of at least `minItemWidth` fit in `width` with `gap` between them (the CSS auto-fill rule). */
export function autoColumns(width: number, minItemWidth: number, gap: number, maxColumns = Number.POSITIVE_INFINITY): number {
  if (!(width > 0) || !(minItemWidth > 0)) return 1;
  const fit = Math.floor((width + gap) / (minItemWidth + gap));
  return Math.max(1, Math.min(maxColumns, fit));
}

export function rowCountFor(count: number, columns: number): number {
  return count <= 0 ? 0 : Math.ceil(count / Math.max(1, columns));
}

export function rowOfIndex(index: number, columns: number): number {
  return Math.floor(index / Math.max(1, columns));
}

/**
 * Top edge of every row, plus one extra entry for the bottom of the last row (including a trailing gap).
 * `heightOf(row)` is the measured height, or the estimate for a row that has not been drawn yet.
 */
export function buildOffsets(rows: number, heightOf: (row: number) => number, rowGap: number): Float64Array {
  const offsets = new Float64Array(rows + 1);
  let y = 0;
  for (let row = 0; row < rows; row += 1) {
    offsets[row] = y;
    y += Math.max(0, heightOf(row)) + rowGap;
  }
  offsets[rows] = y;
  return offsets;
}

/** Total scroll height: the last offset without the trailing gap. */
export function totalHeight(offsets: Float64Array, rowGap: number): number {
  const rows = offsets.length - 1;
  return rows <= 0 ? 0 : Math.max(0, offsets[rows]! - rowGap);
}

/** The row that contains vertical position `y` (binary search; clamps to the first and last row). */
export function findRow(offsets: Float64Array, y: number): number {
  const rows = offsets.length - 1;
  if (rows <= 0) return 0;
  let lo = 0;
  let hi = rows - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid]! <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface RowRange {
  first: number;
  /** Exclusive. */
  last: number;
}

/** Rows that touch the viewport, widened by `overscan` rows on both sides. `scrollTop` is relative to the list top. */
export function rowRange(offsets: Float64Array, scrollTop: number, viewportHeight: number, overscan: number): RowRange {
  const rows = offsets.length - 1;
  if (rows <= 0) return { first: 0, last: 0 };
  const top = Math.max(0, scrollTop);
  const bottom = Math.max(top, scrollTop + Math.max(0, viewportHeight));
  const first = findRow(offsets, top);
  let last = findRow(offsets, bottom);
  // `bottom` exactly on the top edge of a row means that row is not visible.
  if (last > first && offsets[last]! >= bottom) last -= 1;
  const pad = Math.max(0, Math.floor(overscan));
  return { first: Math.max(0, first - pad), last: Math.min(rows, last + 1 + pad) };
}

/** Widen `range` so that it also holds `row` and the `overscan` rows around it (the row that has keyboard focus). */
export function includeRow(range: RowRange, row: number | null, rows: number, overscan: number): RowRange {
  if (row === null || row < 0 || row >= rows) return range;
  const pad = Math.max(0, Math.floor(overscan));
  const first = Math.max(0, row - pad);
  const last = Math.min(rows, row + 1 + pad);
  if (range.last <= range.first) return { first, last };
  return { first: Math.min(range.first, first), last: Math.max(range.last, last) };
}

export type NavKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End' | 'PageUp' | 'PageDown';

export const NAV_KEYS: ReadonlySet<string> = new Set<NavKey>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

/**
 * Where a navigation key moves from item `index`, or `null` when it does not move (already at the edge, or a key
 * that means nothing in a one-column list). Down from a short last row lands on the last item.
 */
export function navigate(key: string, index: number, count: number, columns: number, pageRows: number): number | null {
  if (count <= 0) return null;
  const cols = Math.max(1, columns);
  const last = count - 1;
  const clamp = (n: number) => Math.min(last, Math.max(0, n));
  let target: number | null;
  switch (key) {
    case 'ArrowDown':
      target = rowOfIndex(index, cols) < rowOfIndex(last, cols) ? clamp(index + cols) : null;
      break;
    case 'ArrowUp':
      target = index - cols >= 0 ? index - cols : null;
      break;
    case 'ArrowRight':
      target = cols > 1 && index < last ? index + 1 : null;
      break;
    case 'ArrowLeft':
      target = cols > 1 && index > 0 ? index - 1 : null;
      break;
    case 'Home':
      target = 0;
      break;
    case 'End':
      target = last;
      break;
    case 'PageDown':
      target = clamp(index + cols * Math.max(1, pageRows));
      break;
    case 'PageUp':
      target = clamp(index - cols * Math.max(1, pageRows));
      break;
    default:
      target = null;
  }
  return target === null || target === index ? null : target;
}

/** Scroll position that brings `[top, bottom]` into a viewport, moving as little as possible. */
export function scrollToReveal(
  scrollTop: number,
  viewportHeight: number,
  top: number,
  bottom: number,
  align: 'start' | 'center' | 'end' | 'nearest',
  paddingTop = 0,
): number {
  const visibleTop = scrollTop + paddingTop;
  const visibleHeight = Math.max(0, viewportHeight - paddingTop);
  const visibleBottom = scrollTop + viewportHeight;
  switch (align) {
    case 'start':
      return Math.max(0, top - paddingTop);
    case 'end':
      return Math.max(0, bottom - viewportHeight);
    case 'center':
      return Math.max(0, top - paddingTop - (visibleHeight - (bottom - top)) / 2);
    default:
      if (top < visibleTop) return Math.max(0, top - paddingTop);
      if (bottom > visibleBottom) return Math.max(0, bottom - viewportHeight);
      return scrollTop;
  }
}
