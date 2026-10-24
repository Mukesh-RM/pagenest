import { describe, expect, it } from 'vitest';
import { FIRST_DRAW, measureGrid, windowFor } from './virtual';

const phone = { columns: 2, pitch: 280 };

describe('windowFor', () => {
  it('draws a first handful before anything is measured', () => {
    expect(windowFor(null, 5000, 0, 800)).toEqual({ start: 0, end: FIRST_DRAW, padTop: 0, padBottom: 0 });
    expect(windowFor(null, 5, 0, 800)).toEqual({ start: 0, end: 5, padTop: 0, padBottom: 0 });
  });
  it('draws nothing for an empty library', () => {
    expect(windowFor(phone, 0, 0, 800)).toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0 });
  });
  it('draws only the rows near the screen, however many books there are', () => {
    const top = windowFor(phone, 5000, 0, 800);
    expect(top.start).toBe(0);
    expect(top.end).toBeLessThan(20);
    expect(top.padTop).toBe(0);
    const middle = windowFor(phone, 5000, 100_000, 800);
    expect(middle.end - middle.start).toBeLessThan(24);
    expect(middle.start % phone.columns).toBe(0);
  });
  it('keeps the page the same height as if every row were drawn', () => {
    for (const scrollTop of [0, 1234, 100_000, 699_000]) {
      const w = windowFor(phone, 5000, scrollTop, 800);
      const drawnRows = Math.ceil((w.end - w.start) / phone.columns);
      expect(w.padTop + drawnRows * phone.pitch + w.padBottom).toBe(Math.ceil(5000 / phone.columns) * phone.pitch);
    }
  });
  it('reaches the very last book', () => {
    const w = windowFor(phone, 4999, 10_000_000, 800);
    expect(w.end).toBe(4999);
    expect(w.padBottom).toBe(0);
    expect(w.end).toBeGreaterThan(w.start);
  });
  it('works for a list of single rows', () => {
    const w = windowFor({ columns: 1, pitch: 88 }, 5000, 20_000, 800);
    expect(w.end - w.start).toBeLessThan(40);
    expect(w.start).toBe(Math.floor((20_000 - 480) / 88));
  });
});

describe('measureGrid', () => {
  it('reads columns and the row pitch from the laid-out grid', () => {
    const list = document.createElement('ul');
    list.style.display = 'grid';
    const item = document.createElement('li');
    list.append(item);
    document.body.append(list);
    item.getBoundingClientRect = () => ({ height: 240 }) as DOMRect;
    // jsdom has no layout: no grid tracks and no row gap, so it is one column and the pitch is the card height.
    expect(measureGrid(list)).toEqual({ columns: 1, pitch: 240 });
    list.remove();
  });
  it('has nothing to measure without a card or without a height', () => {
    const list = document.createElement('ul');
    expect(measureGrid(list)).toBeNull();
    list.append(document.createElement('li'));
    expect(measureGrid(list)).toBeNull();
  });
});
