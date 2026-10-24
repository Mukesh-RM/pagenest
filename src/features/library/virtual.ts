import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { ViewMode } from './model';

/** Window virtualization for the grid and list: only the rows near the screen exist in the page. */

export const GRID_GAP = 16;
export const LIST_GAP = 8;
export const MIN_CARD_WIDTH = 144;
/** A cover is 2:3. */
export const COVER_RATIO = 1.5;
const OVERSCAN_PX = 480;

export interface LayoutInput {
  width: number;
  count: number;
  mode: ViewMode;
  /** Height of the title and author block under a grid cover. */
  metaHeight: number;
  /** Height of one list row. */
  rowHeight: number;
}

export interface Layout {
  columns: number;
  gap: number;
  itemWidth: number;
  itemHeight: number;
  /** Distance from the top of one row to the top of the next. */
  pitch: number;
  rows: number;
  totalHeight: number;
}

export function computeLayout({ width, count, mode, metaHeight, rowHeight }: LayoutInput): Layout {
  const w = Math.max(0, Math.floor(width));
  if (mode === 'list') {
    const columns = w >= 960 ? 2 : 1;
    const gap = LIST_GAP;
    const itemWidth = columns === 1 ? w : (w - GRID_GAP) / 2;
    const rows = Math.ceil(count / columns);
    const pitch = rowHeight + gap;
    return { columns, gap, itemWidth, itemHeight: rowHeight, pitch, rows, totalHeight: Math.max(0, rows * pitch - gap) };
  }
  const gap = GRID_GAP;
  const columns = Math.max(2, Math.floor((w + gap) / (MIN_CARD_WIDTH + gap)));
  const itemWidth = Math.max(0, (w - gap * (columns - 1)) / columns);
  const itemHeight = Math.round(itemWidth * COVER_RATIO) + metaHeight;
  const rows = Math.ceil(count / columns);
  const pitch = itemHeight + gap;
  return { columns, gap, itemWidth, itemHeight, pitch, rows, totalHeight: Math.max(0, rows * pitch - gap) };
}

export interface RowRange {
  first: number;
  /** Exclusive. */
  last: number;
}

/** Rows that touch the screen (plus a little above and below), given how far the list is scrolled. */
export function visibleRows(layout: Layout, scrollTop: number, viewportHeight: number, overscanPx: number = OVERSCAN_PX): RowRange {
  if (layout.rows === 0 || layout.pitch <= 0) return { first: 0, last: 0 };
  const top = Math.max(0, scrollTop - overscanPx);
  const bottom = scrollTop + viewportHeight + overscanPx;
  const first = Math.min(layout.rows, Math.max(0, Math.floor(top / layout.pitch)));
  const last = Math.min(layout.rows, Math.max(first, Math.ceil(bottom / layout.pitch)));
  return { first, last };
}

export interface ItemBox {
  index: number;
  x: number;
  y: number;
}

export function itemBoxes(layout: Layout, range: RowRange, count: number): ItemBox[] {
  const out: ItemBox[] = [];
  for (let row = range.first; row < range.last; row += 1) {
    for (let col = 0; col < layout.columns; col += 1) {
      const index = row * layout.columns + col;
      if (index >= count) return out;
      out.push({ index, x: col * (layout.itemWidth + layout.gap), y: row * layout.pitch });
    }
  }
  return out;
}

export interface VirtualState {
  layout: Layout;
  boxes: ItemBox[];
  /** False until the container has a width, so nothing is drawn at the wrong size. */
  ready: boolean;
}

/**
 * Tracks the container width and the page scroll, and returns the items to draw. Only re-renders when
 * the visible rows change, not on every scroll event.
 */
export function useWindowVirtual(
  ref: RefObject<HTMLElement | null>,
  { count, mode, metaHeight, rowHeight }: Omit<LayoutInput, 'width'>,
): VirtualState {
  const [width, setWidth] = useState(0);
  const [range, setRange] = useState<RowRange>({ first: 0, last: 0 });
  const layoutRef = useRef<Layout>(computeLayout({ width: 0, count, mode, metaHeight, rowHeight }));
  const layout = computeLayout({ width, count, mode, metaHeight, rowHeight });
  layoutRef.current = layout;
  const frame = useRef(0);

  const update = useCallback(() => {
    frame.current = 0;
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top; // distance from the top of the viewport
    const next = visibleRows(layoutRef.current, -top, window.innerHeight);
    setRange((prev) => (prev.first === next.first && prev.last === next.last ? prev : next));
  }, [ref]);

  const schedule = useCallback(() => {
    if (frame.current === 0) frame.current = requestAnimationFrame(update);
  }, [update]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  useEffect(() => {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [schedule]);

  // Recompute whenever the layout itself changes (width, count, mode, text size).
  useLayoutEffect(() => {
    update();
  }, [update, layout.pitch, layout.rows, layout.columns, width]);

  const clamped: RowRange = { first: Math.min(range.first, layout.rows), last: Math.min(range.last, layout.rows) };
  return { layout, boxes: width > 0 ? itemBoxes(layout, clamped, count) : [], ready: width > 0 };
}
