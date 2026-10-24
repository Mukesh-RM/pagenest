import { describe, expect, it } from 'vitest';
import { autoColumns, buildOffsets, findRow, includeRow, navigate, rowCountFor, rowOfIndex, rowRange, scrollToReveal, totalHeight } from './virtual';

const fixed = (h: number) => () => h;

describe('columns and rows', () => {
  it('autoColumns follows the CSS auto-fill rule', () => {
    expect(autoColumns(360, 144, 16)).toBe(2);
    expect(autoColumns(1000, 176, 20)).toBe(5);
    expect(autoColumns(100, 144, 16)).toBe(1);
    expect(autoColumns(0, 144, 16)).toBe(1);
    expect(autoColumns(2000, 100, 0, 6)).toBe(6);
  });
  it('counts rows', () => {
    expect(rowCountFor(0, 3)).toBe(0);
    expect(rowCountFor(7, 3)).toBe(3);
    expect(rowCountFor(6, 3)).toBe(2);
    expect(rowOfIndex(5, 3)).toBe(1);
  });
});

describe('offsets', () => {
  it('stacks rows with gaps and reports the total without the trailing gap', () => {
    const o = buildOffsets(4, fixed(100), 10);
    expect(Array.from(o)).toEqual([0, 110, 220, 330, 440]);
    expect(totalHeight(o, 10)).toBe(430);
    expect(totalHeight(buildOffsets(0, fixed(1), 8), 8)).toBe(0);
  });
  it('findRow is a binary search that clamps', () => {
    const o = buildOffsets(1000, fixed(50), 0);
    expect(findRow(o, -20)).toBe(0);
    expect(findRow(o, 0)).toBe(0);
    expect(findRow(o, 49.9)).toBe(0);
    expect(findRow(o, 50)).toBe(1);
    expect(findRow(o, 24_999)).toBe(499);
    expect(findRow(o, 10_000_000)).toBe(999);
  });
  it('works with uneven measured heights', () => {
    const heights = [40, 200, 40, 40];
    const o = buildOffsets(4, (r) => heights[r]!, 0);
    expect(findRow(o, 39)).toBe(0);
    expect(findRow(o, 41)).toBe(1);
    expect(findRow(o, 239)).toBe(1);
    expect(findRow(o, 241)).toBe(2);
  });
});

describe('rowRange', () => {
  const o = buildOffsets(1000, fixed(100), 0);
  it('returns the rows on screen plus overscan, as an exclusive range', () => {
    expect(rowRange(o, 0, 300, 0)).toEqual({ first: 0, last: 3 });
    expect(rowRange(o, 0, 300, 2)).toEqual({ first: 0, last: 5 });
    expect(rowRange(o, 5000, 300, 2)).toEqual({ first: 48, last: 55 });
  });
  it('a row whose top edge is exactly the bottom of the screen is not drawn', () => {
    expect(rowRange(o, 0, 100, 0)).toEqual({ first: 0, last: 1 });
    expect(rowRange(o, 50, 100, 0)).toEqual({ first: 0, last: 2 });
  });
  it('clamps at the ends and handles empty lists', () => {
    expect(rowRange(o, 99_000, 5000, 3)).toEqual({ first: 987, last: 1000 });
    expect(rowRange(o, -500, 300, 1)).toEqual({ first: 0, last: 2 });
    expect(rowRange(buildOffsets(0, fixed(1), 0), 0, 500, 3)).toEqual({ first: 0, last: 0 });
  });
  it('draws a bounded number of rows however long the list is', () => {
    const big = buildOffsets(1_000_000, fixed(100), 8);
    const r = rowRange(big, 40_000_000, 800, 3);
    expect(r.last - r.first).toBeLessThanOrEqual(8 + 1 + 6);
  });
});

describe('includeRow', () => {
  it('keeps the focused row and its neighbours in the range', () => {
    expect(includeRow({ first: 0, last: 5 }, 500, 1000, 2)).toEqual({ first: 0, last: 503 });
    expect(includeRow({ first: 10, last: 15 }, 12, 1000, 2)).toEqual({ first: 10, last: 15 });
    expect(includeRow({ first: 10, last: 15 }, null, 1000, 2)).toEqual({ first: 10, last: 15 });
    expect(includeRow({ first: 0, last: 0 }, 3, 10, 1)).toEqual({ first: 2, last: 5 });
  });
});

describe('navigate', () => {
  it('list: up, down, home, end, pages', () => {
    expect(navigate('ArrowDown', 3, 10, 1, 5)).toBe(4);
    expect(navigate('ArrowUp', 3, 10, 1, 5)).toBe(2);
    expect(navigate('ArrowDown', 9, 10, 1, 5)).toBeNull();
    expect(navigate('ArrowUp', 0, 10, 1, 5)).toBeNull();
    expect(navigate('ArrowRight', 3, 10, 1, 5)).toBeNull();
    expect(navigate('Home', 6, 10, 1, 5)).toBe(0);
    expect(navigate('End', 6, 10, 1, 5)).toBe(9);
    expect(navigate('PageDown', 2, 100, 1, 5)).toBe(7);
    expect(navigate('PageUp', 2, 100, 1, 5)).toBe(0);
    expect(navigate('PageDown', 98, 100, 1, 5)).toBe(99);
  });
  it('grid: moves by one item or one row, and lands on the last item of a short row', () => {
    expect(navigate('ArrowRight', 3, 10, 4, 3)).toBe(4);
    expect(navigate('ArrowLeft', 3, 10, 4, 3)).toBe(2);
    expect(navigate('ArrowDown', 1, 10, 4, 3)).toBe(5);
    expect(navigate('ArrowDown', 5, 10, 4, 3)).toBe(9);
    expect(navigate('ArrowDown', 9, 10, 4, 3)).toBeNull();
    expect(navigate('ArrowUp', 5, 10, 4, 3)).toBe(1);
    expect(navigate('ArrowUp', 2, 10, 4, 3)).toBeNull();
    expect(navigate('ArrowRight', 9, 10, 4, 3)).toBeNull();
    expect(navigate('PageDown', 0, 100, 4, 3)).toBe(12);
  });
  it('ignores other keys and empty lists', () => {
    expect(navigate('a', 0, 10, 1, 3)).toBeNull();
    expect(navigate('Home', 0, 0, 1, 3)).toBeNull();
    expect(navigate('Home', 0, 10, 1, 3)).toBeNull();
  });
});

describe('scrollToReveal', () => {
  it('nearest moves only as far as needed', () => {
    expect(scrollToReveal(100, 500, 200, 300, 'nearest')).toBe(100);
    expect(scrollToReveal(100, 500, 50, 150, 'nearest')).toBe(50);
    expect(scrollToReveal(100, 500, 650, 750, 'nearest')).toBe(250);
  });
  it('start, end and center', () => {
    expect(scrollToReveal(0, 500, 1000, 1100, 'start')).toBe(1000);
    expect(scrollToReveal(0, 500, 1000, 1100, 'end')).toBe(600);
    expect(scrollToReveal(0, 500, 1000, 1100, 'center')).toBe(800);
  });
  it('keeps room for a sticky header', () => {
    expect(scrollToReveal(100, 500, 90, 190, 'nearest', 64)).toBe(26);
    expect(scrollToReveal(0, 500, 1000, 1100, 'start', 64)).toBe(936);
  });
});
