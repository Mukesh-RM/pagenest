import { describe, expect, it } from 'vitest';
import { PageLayout } from './page-layout';

const make = (columns = 1) =>
  new PageLayout({ pageCount: 5, estimate: { width: 600, height: 800 }, viewportWidth: 600, columns, gap: 8 });

describe('PageLayout.anchorAt', () => {
  it('reports the page and fraction inside a page', () => {
    const l = make();
    const box = l.boxOf(2);
    const a = l.anchorAt(box.y + box.height / 2);
    expect(a.page).toBe(2);
    expect(a.offset).toBeCloseTo(0.5, 2);
  });

  it('in the gap under a page, reports the top of the next page, not the end of the one above', () => {
    const l = make();
    const first = l.boxOf(1);
    const a = l.anchorAt(first.y + first.height + 2);
    expect(a).toEqual({ page: 2, offset: 0 });
  });

  it('keeps the last page when there is no next row', () => {
    const l = make();
    const last = l.boxOf(5);
    const a = l.anchorAt(last.y + last.height + 2);
    expect(a.page).toBe(5);
    expect(a.offset).toBe(1);
  });

  it('works in two columns, naming the left page of the next row', () => {
    const l = make(2);
    const row = l.boxOf(1);
    expect(l.anchorAt(row.y + row.height + 2).page).toBe(3);
  });
});
