import { describe, expect, it } from 'vitest';
import { computeLayout, itemBoxes, visibleRows } from './virtual';

const base = { count: 5000, mode: 'grid' as const, metaHeight: 72, rowHeight: 72 };

describe('grid layout', () => {
  it('uses 2 columns on a small phone and more on a laptop', () => {
    expect(computeLayout({ ...base, width: 328 }).columns).toBe(2);
    expect(computeLayout({ ...base, width: 398 }).columns).toBe(2);
    expect(computeLayout({ ...base, width: 1000 }).columns).toBe(6);
  });
  it('fills the width and keeps covers 2:3', () => {
    const l = computeLayout({ ...base, width: 328 });
    expect(l.itemWidth * l.columns + l.gap * (l.columns - 1)).toBeCloseTo(328);
    expect(l.itemHeight).toBe(Math.round(l.itemWidth * 1.5) + 72);
    expect(l.totalHeight).toBe(l.rows * l.pitch - l.gap);
  });
  it('has no height when empty', () => {
    expect(computeLayout({ ...base, count: 0, width: 400 }).totalHeight).toBe(0);
  });
});

describe('list layout', () => {
  it('is one column on a phone and two on a wide screen', () => {
    expect(computeLayout({ ...base, mode: 'list', width: 360 }).columns).toBe(1);
    expect(computeLayout({ ...base, mode: 'list', width: 1100 }).columns).toBe(2);
    const l = computeLayout({ ...base, mode: 'list', width: 360 });
    expect(l.pitch).toBe(80);
    expect(l.totalHeight).toBe(5000 * 80 - 8);
  });
});

describe('visible rows', () => {
  const layout = computeLayout({ ...base, width: 328 });
  it('only covers the screen and a little around it', () => {
    const r = visibleRows(layout, 0, 800);
    expect(r.first).toBe(0);
    expect(r.last).toBeLessThan(10);
    const mid = visibleRows(layout, 100_000, 800);
    expect(mid.last - mid.first).toBeLessThan(12);
    expect(mid.first * layout.pitch).toBeLessThanOrEqual(100_000);
  });
  it('stays inside the list', () => {
    const r = visibleRows(layout, 10_000_000, 800);
    expect(r.last).toBe(layout.rows);
    expect(visibleRows(layout, -500, 800).first).toBe(0);
    expect(visibleRows(computeLayout({ ...base, count: 0, width: 300 }), 0, 800)).toEqual({ first: 0, last: 0 });
  });
  it('places items by row and column and stops at the last item', () => {
    const l = computeLayout({ ...base, count: 5, width: 328 });
    const boxes = itemBoxes(l, { first: 0, last: l.rows }, 5);
    expect(boxes.map((b) => b.index)).toEqual([0, 1, 2, 3, 4]);
    expect(boxes[1]?.x).toBeCloseTo(l.itemWidth + l.gap);
    expect(boxes[2]?.y).toBe(l.pitch);
  });
});
