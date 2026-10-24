import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Window virtualization for the design system's own book grid (`pn-library__grid`). The list keeps the
 * design system's CSS: its columns, gaps and card sizes. Only the rows near the screen are in the page.
 * Space for the rows that are not drawn is added as padding above and below the grid, so the scroll
 * bar and the scroll position behave exactly as if every book were there.
 */

/** Rows drawn above and below the screen, in pixels. */
export const OVERSCAN_PX = 480;
/** Books drawn before the first measurement tells how many columns and how tall a row is. */
export const FIRST_DRAW = 24;

/** What the browser laid out for the design system's grid. */
export interface Geometry {
  columns: number;
  /** Distance from the top of one row to the top of the next: card height plus row gap. */
  pitch: number;
}

export interface Window {
  /** First book drawn. */
  start: number;
  /** One past the last book drawn. */
  end: number;
  /** Space standing in for the rows above and below. */
  padTop: number;
  padBottom: number;
}

/** Books to draw for a page scrolled `scrollTop` px into the grid, in a viewport `viewportHeight` px tall. */
export function windowFor(geometry: Geometry | null, count: number, scrollTop: number, viewportHeight: number, overscanPx: number = OVERSCAN_PX): Window {
  if (count <= 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 };
  if (!geometry || geometry.columns < 1 || geometry.pitch <= 0) return { start: 0, end: Math.min(count, FIRST_DRAW), padTop: 0, padBottom: 0 };
  const { columns, pitch } = geometry;
  const rows = Math.ceil(count / columns);
  const first = Math.min(rows - 1, Math.max(0, Math.floor(Math.max(0, scrollTop - overscanPx) / pitch)));
  const last = Math.min(rows, Math.max(first + 1, Math.ceil((scrollTop + viewportHeight + overscanPx) / pitch)));
  return { start: first * columns, end: Math.min(count, last * columns), padTop: first * pitch, padBottom: (rows - last) * pitch };
}

/** Columns and row pitch of a laid-out grid, read from the browser. `null` when there is nothing to measure. */
export function measureGrid(list: HTMLElement): Geometry | null {
  const first = list.firstElementChild;
  if (!first) return null;
  const style = getComputedStyle(list);
  const tracks = style.gridTemplateColumns;
  const columns = !tracks || tracks === 'none' ? 1 : tracks.split(' ').filter(Boolean).length;
  const gap = parseFloat(style.rowGap);
  const height = first.getBoundingClientRect().height;
  if (!(height > 0)) return null;
  return { columns: Math.max(1, columns), pitch: height + (Number.isFinite(gap) ? gap : 0) };
}

/**
 * Tracks the page scroll and the grid's laid-out size, and returns which books to draw. It only
 * re-renders when the set of drawn rows changes, not on every scroll event.
 */
/** `layoutKey` names the kind of rows (grid or list); when it changes the drawn rows are worked out again. */
export function useGridWindow(ref: RefObject<HTMLElement | null>, count: number, layoutKey: string): Window {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [win, setWin] = useState<Window>(() => windowFor(null, count, 0, 0));
  const geometryRef = useRef<Geometry | null>(null);
  const countRef = useRef(count);
  countRef.current = count;
  const frame = useRef(0);

  const recompute = useCallback(() => {
    frame.current = 0;
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const next = windowFor(geometryRef.current, countRef.current, -top, window.innerHeight);
    setWin((prev) => (prev.start === next.start && prev.end === next.end && prev.padTop === next.padTop && prev.padBottom === next.padBottom ? prev : next));
  }, [ref]);

  const schedule = useCallback(() => {
    if (frame.current === 0) frame.current = requestAnimationFrame(recompute);
  }, [recompute]);

  // After every render: read what the browser laid out. If it changed (width, text size, view), draw again.
  // No dependency list on purpose: a card's height can change with anything that re-renders it, and the
  // state is only set when the measurement really changed, so this cannot loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = measureGrid(el);
    const prev = geometryRef.current;
    if (next && (!prev || prev.columns !== next.columns || Math.abs(prev.pitch - next.pitch) > 0.5)) {
      geometryRef.current = next;
      setGeometry(next);
    }
  });

  useLayoutEffect(() => {
    recompute();
  }, [recompute, geometry, count, layoutKey]);

  useEffect(() => {
    const el = ref.current;
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = typeof ResizeObserver === 'undefined' || !el ? undefined : new ResizeObserver(() => {
      const fresh = measureGrid(el);
      const prev = geometryRef.current;
      if (fresh && (!prev || prev.columns !== fresh.columns || Math.abs(prev.pitch - fresh.pitch) > 0.5)) {
        geometryRef.current = fresh;
        setGeometry(fresh);
      }
    });
    if (observer && el) observer.observe(el);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [ref, schedule]);

  return clampWindow(win, count);
}

/** The count can shrink between a render and the next measurement; never draw books that are gone. */
function clampWindow(win: Window, count: number): Window {
  if (win.end <= count && win.start <= count) return win;
  return { ...win, start: Math.min(win.start, count), end: Math.min(win.end, count) };
}
