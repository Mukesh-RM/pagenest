import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VirtualList, type VirtualListHandle } from './VirtualList';

const numbers = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Drives the page scroll in jsdom: the list's top edge is `-scrollY` from the viewport top. */
let scrollY = 0;
const frames: FrameRequestCallback[] = [];
beforeEach(() => {
  scrollY = 0;
  frames.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const top = this.classList.contains('pn-vlist__inner') ? -scrollY : 0;
    return { top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
  vi.stubGlobal('scrollTo', vi.fn());
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const scrollTo = (y: number) => {
  scrollY = y;
  act(() => {
    window.dispatchEvent(new Event('scroll'));
    for (const cb of frames.splice(0)) cb(0);
  });
};
const cells = () => screen.queryAllByRole('listitem');
const indexes = () => cells().map((c) => Number(c.getAttribute('data-index')));

function Item({ n }: { n: number }) {
  return (
    <button type="button" data-testid={`b${n}`}>
      Book {n + 1}
    </button>
  );
}

function list(count: number, props: Partial<React.ComponentProps<typeof VirtualList<number>>> = {}) {
  return (
    <VirtualList<number>
      items={numbers(count)}
      renderItem={(n) => <Item n={n} />}
      rowHeight={100}
      initialSize={{ width: 400, height: 600 }}
      aria-label="Books"
      {...props}
    />
  );
}

describe('VirtualList: windowing', () => {
  it('draws only the rows near the screen, however long the list is', () => {
    render(list(10_000));
    expect(cells().length).toBeGreaterThan(0);
    expect(cells().length).toBeLessThan(15);
    expect(indexes()[0]).toBe(0);
  });

  it('sets the full scroll height from the row height and gap', () => {
    render(list(1000, { rowGap: 10 }));
    expect(screen.getByRole('list', { name: 'Books' })).toHaveStyle({ height: `${1000 * 110 - 10}px` });
  });

  it('follows the scroll and unmounts what left the screen', () => {
    render(list(10_000));
    expect(screen.queryByText('Book 5001')).toBeNull();
    scrollTo(500_000);
    expect(screen.getByText('Book 5001')).toBeInTheDocument();
    expect(screen.queryByText('Book 1')).toBeNull();
    expect(cells().length).toBeLessThan(15);
    scrollTo(0);
    expect(screen.getByText('Book 1')).toBeInTheDocument();
  });

  it('places rows with transform, not top', () => {
    render(list(100));
    const row = document.querySelector<HTMLElement>('[data-row="2"]')!;
    expect(row.style.transform).toBe('translate3d(0, 200px, 0)');
    expect(row.style.top).toBe('');
  });

  it('overscan widens the drawn range', () => {
    const { rerender } = render(list(1000, { overscan: 0 }));
    const tight = cells().length;
    rerender(list(1000, { overscan: 6 }));
    expect(cells().length).toBeGreaterThan(tight);
  });

  it('lays out columns, from a number or a function of the width', () => {
    const { rerender } = render(list(100, { columns: 4, gap: 8 }));
    expect(document.querySelector<HTMLElement>('[data-row="0"]')!.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    expect(indexes().slice(0, 5)).toEqual([0, 1, 2, 3, 4]);
    rerender(list(100, { columns: (w) => Math.floor(w / 100) }));
    expect(document.querySelector<HTMLElement>('[data-row="0"]')!.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    rerender(list(7, { columns: 3 }));
    expect(document.querySelectorAll('[data-row="2"] [role="listitem"]')).toHaveLength(1);
  });

  it('reports the drawn range', () => {
    const onRange = vi.fn();
    render(list(1000, { onRangeChange: onRange }));
    expect(onRange).toHaveBeenCalledWith(expect.objectContaining({ firstIndex: 0 }));
    scrollTo(30_000);
    const last = onRange.mock.calls.at(-1)![0] as { firstIndex: number; lastIndex: number };
    expect(last.firstIndex).toBeGreaterThan(200);
    expect(last.lastIndex).toBeGreaterThan(last.firstIndex);
  });

  it('shows an empty list as an empty container', () => {
    render(list(0));
    expect(cells()).toHaveLength(0);
    expect(screen.getByRole('list', { name: 'Books' })).toHaveStyle({ height: '0px' });
  });

  it('a short list is fully drawn', () => {
    render(list(5));
    expect(cells()).toHaveLength(5);
  });
});

describe('VirtualList: measured rows', () => {
  it('uses the estimate before measuring and has no fixed row height', () => {
    render(list(200, { rowHeight: undefined, estimatedRowHeight: 80 }));
    expect(screen.getByRole('list', { name: 'Books' })).toHaveStyle({ height: `${200 * 80}px` });
    expect(document.querySelector<HTMLElement>('[data-row="0"]')!.style.height).toBe('');
  });
});

describe('VirtualList: accessibility', () => {
  it('is a list of listitems with position and set size for the whole set', () => {
    render(list(4800));
    const first = cells()[0]!;
    expect(first).toHaveAttribute('aria-posinset', '1');
    expect(first).toHaveAttribute('aria-setsize', '4800');
    scrollTo(100 * 2000);
    const mid = screen.getByText('Book 2001').closest('[role="listitem"]')!;
    expect(mid).toHaveAttribute('aria-posinset', '2001');
    expect(mid).toHaveAttribute('aria-setsize', '4800');
  });

  it('rows are presentational, so list > listitem ownership holds', () => {
    render(list(10, { columns: 2 }));
    for (const row of document.querySelectorAll('[data-row]')) expect(row).toHaveAttribute('role', 'presentation');
    const items = within(screen.getByRole('list', { name: 'Books' })).getAllByRole('listitem');
    expect(items.length).toBe(10);
  });

  it('can be a listbox of options', () => {
    render(list(5, { role: 'listbox' }));
    expect(screen.getByRole('listbox', { name: 'Books' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(5);
  });
});

describe('VirtualList: keyboard', () => {
  it('arrow keys move focus between items, and Home and End jump across the whole list', () => {
    render(list(1000));
    act(() => screen.getByTestId('b0').focus());
    fireEvent.keyDown(screen.getByTestId('b0'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByTestId('b1'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByTestId('b0'));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByTestId('b999'));
    expect(screen.getByText('Book 1000')).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByTestId('b0'));
  });

  it('in a grid, left and right move by one and up and down by a row', () => {
    render(list(100, { columns: 4 }));
    act(() => screen.getByTestId('b5').focus());
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByTestId('b6'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByTestId('b10'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByTestId('b9'));
  });

  it('page keys move a screenful', () => {
    render(list(1000));
    act(() => screen.getByTestId('b0').focus());
    fireEvent.keyDown(document.activeElement!, { key: 'PageDown' });
    expect(document.activeElement).toBe(screen.getByTestId('b5'));
  });

  it('keeps the focused item in the page after it scrolls far away', () => {
    render(list(10_000));
    act(() => screen.getByTestId('b3').focus());
    scrollTo(400_000);
    expect(screen.getByTestId('b3')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId('b3'));
    act(() => (document.activeElement as HTMLElement).blur());
    expect(screen.queryByTestId('b3')).toBeNull();
  });

  it('leaves keys alone inside text fields and when switched off', () => {
    const { rerender } = render(
      list(20, { renderItem: (n) => <input aria-label={`field ${n}`} defaultValue="x" /> }),
    );
    act(() => screen.getByLabelText('field 0').focus());
    fireEvent.keyDown(screen.getByLabelText('field 0'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByLabelText('field 0'));
    rerender(list(20, { keyboardNav: false }));
    act(() => screen.getByTestId('b0').focus());
    fireEvent.keyDown(screen.getByTestId('b0'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByTestId('b0'));
  });

  it('does not swallow keys at the edges, so the page can still scroll', () => {
    render(list(3));
    act(() => screen.getByTestId('b2').focus());
    const notPrevented = fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(notPrevented).toBe(true);
  });

  it('items without a focusable child take focus themselves', () => {
    const handle = createRef<VirtualListHandle>();
    render(list(30, { ref: handle, renderItem: (n) => <span>Plain {n + 1}</span> }));
    act(() => handle.current!.focusItem(2));
    expect(document.activeElement).toHaveAttribute('data-index', '2');
  });
});

describe('VirtualList: imperative handle', () => {
  it('scrollToIndex scrolls the page to the row', () => {
    const scroll = vi.fn();
    vi.stubGlobal('scrollTo', scroll);
    const handle = createRef<VirtualListHandle>();
    render(list(1000, { ref: handle }));
    handle.current!.scrollToIndex(500, { align: 'start' });
    expect(scroll).toHaveBeenCalledWith({ top: 50_000 });
  });

  it('focusItem mounts a far item and focuses its button', () => {
    const handle = createRef<VirtualListHandle>();
    render(list(10_000, { ref: handle }));
    act(() => handle.current!.focusItem(7000));
    expect(document.activeElement).toBe(screen.getByTestId('b7000'));
  });
});

describe('VirtualList: self scrolling', () => {
  it('scrolls inside its own box', () => {
    render(list(10_000, { scroller: 'self', initialSize: { width: 400, height: 300 } }));
    const root = document.querySelector<HTMLElement>('.pn-vlist')!;
    expect(root).toHaveClass('pn-vlist--self');
    expect(screen.queryByText('Book 3001')).toBeNull();
    Object.defineProperty(root, 'scrollTop', { configurable: true, value: 300_000 });
    act(() => {
      root.dispatchEvent(new Event('scroll'));
      for (const cb of frames.splice(0)) cb(0);
    });
    expect(screen.getByText('Book 3001')).toBeInTheDocument();
    expect(screen.queryByText('Book 1')).toBeNull();
  });
});

describe('VirtualList: keys', () => {
  it('uses getKey so reordering keeps item identity', () => {
    const items = ['a', 'b', 'c'];
    const { rerender } = render(
      <VirtualList items={items} getKey={(s) => s} renderItem={(s) => <input aria-label={s} />} rowHeight={40} columns={3} initialSize={{ width: 300, height: 300 }} />,
    );
    const a = screen.getByLabelText('a');
    rerender(
      <VirtualList items={['c', 'b', 'a']} getKey={(s) => s} renderItem={(s) => <input aria-label={s} />} rowHeight={40} columns={3} initialSize={{ width: 300, height: 300 }} />,
    );
    expect(screen.getByLabelText('a')).toBe(a);
  });
});
