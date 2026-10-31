import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type Key,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { cx } from '../utils/cx';
import { getFocusable } from '../utils/focus';
import {
  buildOffsets,
  includeRow,
  NAV_KEYS,
  navigate,
  rowCountFor,
  rowOfIndex,
  rowRange,
  scrollToReveal,
  totalHeight,
  type RowRange,
} from '../utils/virtual';

export interface VirtualListHandle {
  /** Scrolls so item `index` is on screen. `nearest` (default) moves as little as possible. */
  scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' | 'nearest' }) => void;
  /** Scrolls to the item, mounts it, and moves keyboard focus into it. */
  focusItem: (index: number) => void;
}

export interface VirtualListProps<T> {
  items: readonly T[];
  /** Draws one item. It sits in a cell that already has the list-item role, `aria-posinset` and `aria-setsize`. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Stable key. Defaults to the index. */
  getKey?: (item: T, index: number) => Key;
  /**
   * Items per row: a number, or a function of the list width in px (use `autoColumns` for "as many as fit").
   * `1` (default) is a plain list.
   */
  columns?: number | ((width: number) => number);
  /** Space between columns in px. */
  gap?: number;
  /** Space between rows in px. */
  rowGap?: number;
  /**
   * Fixed row height in px: nothing is measured, scrolling is exact. Leave out for rows of unknown or text-size
   * dependent height: drawn rows are measured, and rows not drawn yet use the average of the measured ones.
   */
  rowHeight?: number;
  /** First guess for a row height before anything is measured. Default 96. */
  estimatedRowHeight?: number;
  /** Extra rows drawn above and below the screen. Default 3. */
  overscan?: number;
  /** What scrolls: the page (`window`, default) or the list itself (`self`; give the list a height with CSS). */
  scroller?: 'window' | 'self';
  /** Height of anything sticky above the list, so jumping to an item does not hide it under a header. */
  scrollPaddingTop?: number;
  /** `list` (default, items are `listitem`) or `listbox` (items are `option`). */
  role?: 'list' | 'listbox';
  /** Arrow keys, Home, End, Page Up and Page Down move focus between items. Default on. */
  keyboardNav?: boolean;
  /** Width and height used until the real ones are measured (first paint, tests, server render). */
  initialSize?: { width: number; height: number };
  /** Called when the first or last drawn item changes (for prefetching covers, for example). */
  onRangeChange?: (range: { firstIndex: number; lastIndex: number }) => void;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** Test hook. */
  'data-testid'?: string;
}

const TEXT_ENTRY = 'input,textarea,select,[contenteditable="true"],[role="slider"],[role="textbox"],[role="spinbutton"],[role="combobox"]';

function indexFromTarget(target: EventTarget | null): number | null {
  const el = target instanceof Element ? target.closest<HTMLElement>('[data-index]') : null;
  const raw = el?.dataset.index;
  return raw === undefined ? null : Number(raw);
}

interface RowProps {
  row: number;
  top: number;
  columns: number;
  gap: number;
  fixedHeight: number | undefined;
  epoch: string;
  onMeasure: (row: number, height: number) => void;
  children: ReactNode;
}

function VirtualRow({ row, top, columns, gap, fixedHeight, epoch, onMeasure, children }: RowProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || fixedHeight !== undefined) return undefined;
    const report = () => onMeasure(row, el.getBoundingClientRect().height);
    report();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [row, fixedHeight, epoch, onMeasure]);
  return (
    <div
      ref={ref}
      role="presentation"
      className="pn-vlist__row"
      data-row={row}
      style={{
        transform: `translate3d(0, ${top}px, 0)`,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        columnGap: gap,
        height: fixedHeight,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Windowed list and grid: only the rows near the screen are in the page, so ten thousand books cost the same to
 * scroll as thirty. Rows are placed with `transform` (no layout work while scrolling).
 *
 * - **Sizes**: fixed `rowHeight`, or measured rows with an estimate for the rest. Columns from a number or a function
 *   of the width, so a grid can follow the same rules as the CSS grid it replaces.
 * - **Accessibility**: the container is a `list` (or `listbox`), every drawn item is a `listitem` (or `option`) with
 *   `aria-posinset` and `aria-setsize` for the whole set, so a screen reader hears "12 of 4800" even though the
 *   other items are not in the page.
 * - **Keyboard**: Tab walks the drawn items as usual; the item that has focus, and the rows around it, stay drawn
 *   even if it is scrolled far away, so focus is never lost. Arrow keys move by one item or one row, Home and End jump
 *   to the first and last item, Page Up and Page Down move a screenful. Text fields inside items keep their keys.
 * - **Scrolling**: the page by default, or the list itself with `scroller="self"`.
 */
function VirtualListInner<T>(props: VirtualListProps<T>, ref: Ref<VirtualListHandle>) {
  const {
    items,
    renderItem,
    getKey,
    columns = 1,
    gap = 0,
    rowGap = 0,
    rowHeight,
    estimatedRowHeight = 96,
    overscan = 3,
    scroller = 'window',
    scrollPaddingTop = 0,
    role = 'list',
    keyboardNav = true,
    initialSize,
    onRangeChange,
    className,
    style,
  } = props;
  const seed = useRef(initialSize);
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: initialSize?.width ?? 0, height: initialSize?.height ?? 0 });
  const [active, setActive] = useState<number | null>(null);
  const [version, setVersion] = useState(0);

  const cols = Math.max(1, Math.floor(typeof columns === 'function' ? columns(size.width) : columns) || 1);
  const rows = rowCountFor(items.length, cols);

  // Measured row heights. Cleared whenever the width or the column count changes: every row reflows then.
  const measured = useRef(new Map<number, number>());
  const stats = useRef({ sum: 0, n: 0, last: 0 });
  const epoch = `${cols}:${Math.round(size.width)}`;
  const lastEpoch = useRef(epoch);
  if (lastEpoch.current !== epoch) {
    lastEpoch.current = epoch;
    if (stats.current.n > 0) stats.current.last = stats.current.sum / stats.current.n;
    measured.current.clear();
    stats.current.sum = 0;
    stats.current.n = 0;
  }
  const bump = useRef(0);
  const onMeasure = useCallback((row: number, height: number) => {
    if (!(height > 0)) return;
    const prev = measured.current.get(row);
    if (prev !== undefined && Math.abs(prev - height) < 0.5) return;
    measured.current.set(row, height);
    stats.current.sum += height - (prev ?? 0);
    if (prev === undefined) stats.current.n += 1;
    if (bump.current === 0) {
      bump.current = requestAnimationFrame(() => {
        bump.current = 0;
        setVersion((v) => v + 1);
      });
    }
  }, []);
  useEffect(
    () => () => {
      if (bump.current) cancelAnimationFrame(bump.current);
    },
    [],
  );

  const offsets = useMemo(() => {
    const { sum, n, last } = stats.current;
    const guess = rowHeight ?? (n > 0 ? sum / n : last > 0 ? last : estimatedRowHeight);
    return buildOffsets(rows, (row) => rowHeight ?? measured.current.get(row) ?? guess, rowGap);
    // `version` and `epoch` stand for the contents of the measurement cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, rowGap, rowHeight, estimatedRowHeight, version, epoch]);
  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;
  const viewport = useRef({ top: 0, height: initialSize?.height ?? 0 });

  const [range, setRange] = useState<RowRange>(() => rowRange(offsets, 0, initialSize?.height ?? 0, overscan));
  const frame = useRef(0);
  const update = useCallback(() => {
    frame.current = 0;
    const root = rootRef.current;
    const inner = innerRef.current;
    if (!root || !inner) return;
    let top: number;
    let height: number;
    if (scroller === 'self') {
      top = root.scrollTop;
      height = root.clientHeight || seed.current?.height || 0;
    } else {
      top = -inner.getBoundingClientRect().top;
      height = window.innerHeight;
    }
    viewport.current = { top, height };
    const next = rowRange(offsetsRef.current, top, height, overscan);
    setRange((prev) => (prev.first === next.first && prev.last === next.last ? prev : next));
  }, [scroller, overscan]);
  const schedule = useCallback(() => {
    if (frame.current === 0) frame.current = requestAnimationFrame(update);
  }, [update]);

  // Width (and the height of a self-scrolling list).
  useLayoutEffect(() => {
    const root = rootRef.current;
    const inner = innerRef.current;
    if (!root || !inner) return undefined;
    const read = () => {
      const width = inner.clientWidth || seed.current?.width || 0;
      const height = scroller === 'self' ? root.clientHeight || seed.current?.height || 0 : window.innerHeight;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      schedule();
    };
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(inner);
    if (scroller === 'self') observer.observe(root);
    return () => observer.disconnect();
  }, [scroller, schedule]);

  useEffect(() => {
    const target: Window | HTMLElement | null = scroller === 'self' ? rootRef.current : window;
    if (!target) return undefined;
    target.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      target.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [scroller, schedule]);

  // The layout itself changed (count, columns, measured heights): recompute what is on screen.
  useLayoutEffect(() => {
    update();
  }, [update, offsets]);

  const activeRow = active === null ? null : rowOfIndex(active, cols);
  const shown = includeRow({ first: Math.min(range.first, rows), last: Math.min(range.last, rows) }, activeRow, rows, overscan);
  const firstIndex = shown.first * cols;
  const lastIndex = Math.min(items.length, shown.last * cols) - 1;
  const lastReported = useRef('');
  useEffect(() => {
    if (!onRangeChange) return;
    const key = `${firstIndex}:${lastIndex}`;
    if (key === lastReported.current) return;
    lastReported.current = key;
    onRangeChange({ firstIndex, lastIndex });
  }, [firstIndex, lastIndex, onRangeChange]);

  const scrollToIndex = useCallback<VirtualListHandle['scrollToIndex']>(
    (index, options) => {
      const root = rootRef.current;
      const inner = innerRef.current;
      if (!root || !inner || items.length === 0) return;
      const row = rowOfIndex(Math.min(items.length - 1, Math.max(0, index)), cols);
      const o = offsetsRef.current;
      const top = o[row] ?? 0;
      const bottom = (o[row + 1] ?? top) - rowGap;
      const align = options?.align ?? 'nearest';
      if (scroller === 'self') {
        root.scrollTop = scrollToReveal(root.scrollTop, root.clientHeight || seed.current?.height || 0, top, bottom, align, scrollPaddingTop);
      } else {
        const origin = inner.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: scrollToReveal(window.scrollY, window.innerHeight, origin + top, origin + bottom, align, scrollPaddingTop) });
      }
    },
    [cols, items.length, rowGap, scroller, scrollPaddingTop],
  );

  const pendingFocus = useRef<number | null>(null);
  const focusPending = useCallback(() => {
    const index = pendingFocus.current;
    const inner = innerRef.current;
    if (index === null || !inner) return;
    const cell = inner.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!cell) return;
    pendingFocus.current = null;
    let target = getFocusable(cell)[0];
    if (!target) {
      cell.tabIndex = -1;
      target = cell;
    }
    target.focus();
  }, []);
  useLayoutEffect(focusPending);

  const focusItem = useCallback<VirtualListHandle['focusItem']>(
    (index) => {
      if (items.length === 0) return;
      const clamped = Math.min(items.length - 1, Math.max(0, index));
      pendingFocus.current = clamped;
      scrollToIndex(clamped, { align: 'nearest' });
      setActive(clamped);
    },
    [items.length, scrollToIndex],
  );
  useImperativeHandle(ref, () => ({ scrollToIndex, focusItem }), [scrollToIndex, focusItem]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!keyboardNav || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !NAV_KEYS.has(event.key)) return;
    if (event.target instanceof Element && event.target.closest(TEXT_ENTRY)) return;
    const index = indexFromTarget(event.target);
    if (index === null) return;
    const { height } = viewport.current;
    const pitch = rows > 0 ? offsetsRef.current[rows]! / rows : estimatedRowHeight;
    const pageRows = Math.max(1, Math.floor(height / Math.max(1, pitch)) - 1);
    const target = navigate(event.key, index, items.length, cols, pageRows);
    if (target === null) return;
    event.preventDefault();
    focusItem(target);
  };
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const index = indexFromTarget(event.target);
    if (index !== null) setActive((prev) => (prev === index ? prev : index));
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
      // Leaving the list: stop holding the far-away rows in the page, unless a keyboard move is in flight.
      if (pendingFocus.current === null) setActive(null);
    }
  };

  const itemRole = role === 'listbox' ? 'option' : 'listitem';
  const rowNodes: ReactElement[] = [];
  for (let row = shown.first; row < shown.last; row += 1) {
    const cells: ReactElement[] = [];
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const item = items[index];
      if (index >= items.length || item === undefined) break;
      cells.push(
        <div
          key={getKey ? getKey(item, index) : index}
          role={itemRole}
          className="pn-vlist__item"
          data-index={index}
          aria-posinset={index + 1}
          aria-setsize={items.length}
          style={scrollPaddingTop ? { scrollMarginTop: scrollPaddingTop } : undefined}
        >
          {renderItem(item, index)}
        </div>,
      );
    }
    rowNodes.push(
      <VirtualRow
        key={row}
        row={row}
        top={offsets[row] ?? 0}
        columns={cols}
        gap={gap}
        fixedHeight={rowHeight}
        epoch={epoch}
        onMeasure={onMeasure}
      >
        {cells}
      </VirtualRow>,
    );
  }

  return (
    <div
      ref={rootRef}
      className={cx('pn-vlist', scroller === 'self' && 'pn-vlist--self', className)}
      style={style}
      data-testid={props['data-testid']}
      data-virtual="true"
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div
        ref={innerRef}
        role={role}
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        className="pn-vlist__inner"
        style={{ height: totalHeight(offsets, rowGap) }}
      >
        {rowNodes}
      </div>
    </div>
  );
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(props: VirtualListProps<T> & { ref?: Ref<VirtualListHandle> }) => ReactElement | null;
