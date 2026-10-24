import '../test/setup';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installViewport } from '../test/viewport';
import { ThemeProvider } from '../theme';
import type { BookSummary } from '../types';
import { LibraryScreen, type LibraryScreenProps } from './LibraryScreen';
import { libraryColumns, libraryGridSpec } from './libraryGrid';
import { LIBRARY_VIRTUALIZE_ABOVE } from './libraryOptions';

/** Test-only generated titles; the app never ships these. */
const books = (n: number): BookSummary[] => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, title: `Title ${i + 1}`, author: `Author ${i % 7}`, progress: (i % 10) / 10 }));

function screenFor(count: number, props: Partial<LibraryScreenProps> = {}) {
  return (
    <ThemeProvider mode="light">
      <LibraryScreen
        books={books(count)}
        filter="all"
        onFilterChange={() => undefined}
        query=""
        onQueryChange={() => undefined}
        onOpenBook={() => undefined}
        {...props}
      />
    </ThemeProvider>
  );
}

afterEach(() => vi.restoreAllMocks());

describe('LibraryScreen windowing', () => {
  it('draws every book in a small library, in the plain list', () => {
    render(screenFor(LIBRARY_VIRTUALIZE_ABOVE));
    const list = screen.getByRole('list', { name: 'Books' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(LIBRARY_VIRTUALIZE_ABOVE);
    expect(document.querySelector('[data-virtual]')).toBeNull();
  });

  it('windows a large library: a few rows in the page, but the full set size announced', () => {
    const restore = installViewport(1280).restore;
    render(screenFor(5000));
    expect(document.querySelector('[data-virtual="true"]')).not.toBeNull();
    const items = within(screen.getByRole('list', { name: 'Books' })).getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThan(80);
    expect(items[0]).toHaveAttribute('aria-setsize', '5000');
    expect(screen.getByRole('button', { name: /Title 1, Author 0/ })).toBeInTheDocument();
    restore();
  });

  it('virtualizeAbove tunes or turns off the threshold', () => {
    const { rerender } = render(screenFor(30, { virtualizeAbove: 10 }));
    expect(document.querySelector('[data-virtual="true"]')).not.toBeNull();
    rerender(screenFor(3000, { virtualizeAbove: Infinity }));
    expect(document.querySelector('[data-virtual]')).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Books' })).getAllByRole('listitem')).toHaveLength(3000);
  });

  it('windows the list view too', () => {
    render(screenFor(2000, { view: 'list' }));
    expect(document.querySelector('[data-virtual="true"]')).not.toBeNull();
    expect(within(screen.getByRole('list', { name: 'Books' })).getAllByRole('listitem').length).toBeLessThan(40);
  });
});

describe('libraryGrid mirrors the CSS grid', () => {
  it('uses the same minimums and gaps per breakpoint', () => {
    expect(libraryGridSpec('grid', 390)).toMatchObject({ minRem: 9, gap: 16, rowGap: 24 });
    expect(libraryGridSpec('grid', 800)).toMatchObject({ minRem: 10, gap: 20, rowGap: 32 });
    expect(libraryGridSpec('grid', 1100)).toMatchObject({ minRem: 11 });
    expect(libraryGridSpec('grid', 1600)).toMatchObject({ minRem: 12, gap: 24, rowGap: 40 });
  });
  it('picks two columns on a phone and more on a laptop, like auto-fill', () => {
    expect(libraryColumns(libraryGridSpec('grid', 0), 358, 16)).toBe(2);
    expect(libraryColumns(libraryGridSpec('grid', 1024), 900, 16)).toBe(4);
    expect(libraryColumns(libraryGridSpec('grid', 0), 358, 32)).toBe(1);
  });
  it('the list view is one column, two on a laptop', () => {
    expect(libraryColumns(libraryGridSpec('list', 400), 358, 16)).toBe(1);
    expect(libraryColumns(libraryGridSpec('list', 1200), 900, 16)).toBe(2);
  });
});
