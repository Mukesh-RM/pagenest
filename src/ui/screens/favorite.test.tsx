import '../test/setup';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BookCard } from '../components/BookCard';
import { BookCover } from '../components/BookCover';
import { Icon } from '../icons';
import { ICON_NODES } from '../icons/nodes';
import { HIGH_CONTRAST_PALETTE, THEME_PALETTE } from '../theme/palette';
import { THEME_NAMES } from '../theme/themes';
import { declarationsFor, parseCss, readUiFile } from '../test/css';
import { contrastRatio } from '../utils/wcag';
import { isAudioOnly } from '../utils/bookKind';
import type { BookDetail, BookSummary } from '../types';
import { SAMPLE_BOOKS, SAMPLE_DETAIL, SAMPLE_DETAIL_AUDIO } from '../demo/sample-data';
import { BookDetailSheet } from './BookDetailSheet';
import { LibraryScreen } from './LibraryScreen';
import type { StarterBookOffer } from '../components/StarterBookCard';

const noop = () => undefined;
const book: BookSummary = { id: 'x', title: 'Field Notes on Quiet', author: 'Ana Lindqvist', progress: 0.2 };

describe('icons for the Library', () => {
  it('has heart and upload, plus the ones Library defined itself', () => {
    for (const name of ['heart', 'upload', 'list', 'trash', 'pencil', 'layoutGrid', 'circleCheck', 'arrowUpDown'] as const) {
      expect(ICON_NODES[name].length, name).toBeGreaterThan(0);
    }
  });
  it('can be filled', () => {
    const { container, rerender } = render(<Icon name="heart" />);
    expect(container.querySelector('svg')).toHaveAttribute('fill', 'none');
    rerender(<Icon name="heart" filled />);
    expect(container.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
  });
});

describe('favorite badge', () => {
  it('shows on a favorite card, named Favorite, and is part of the card name', () => {
    render(<BookCard book={{ ...book, favorite: true }} onOpen={noop} />);
    expect(screen.getByRole('img', { name: 'Favorite' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Favorite/ })).toBeInTheDocument();
  });

  it('is absent without the flag, and does not touch the audio badge', () => {
    const { rerender } = render(<BookCard book={book} onOpen={noop} />);
    expect(screen.queryByRole('img', { name: 'Favorite' })).toBeNull();
    expect(screen.getByRole('button').getAttribute('aria-label')).not.toMatch(/Favorite/);
    rerender(<BookCard book={{ ...book, audio: true, favorite: true }} onOpen={noop} />);
    expect(document.querySelectorAll('.pn-bookcard__badge')).toHaveLength(2);
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/Has audio\. Favorite/);
  });

  it('BookCover draws it on request, with or without an image', () => {
    const { rerender } = render(<BookCover title="T" favorite />);
    expect(screen.getByRole('img', { name: 'Favorite' })).toBeInTheDocument();
    rerender(<BookCover title="T" src="cover.png" favorite />);
    expect(screen.getByRole('img', { name: 'Favorite' })).toBeInTheDocument();
    rerender(<BookCover title="T" src="cover.png" />);
    expect(screen.queryByRole('img', { name: 'Favorite' })).toBeNull();
  });

  it('is laid over the cover (absolute), bottom left, so nothing shifts', () => {
    const rules = parseCss(readUiFile('styles/components.css'));
    const base = declarationsFor(rules, '.pn-bookcard__badge');
    const fav = declarationsFor(rules, '.pn-bookcard__badge--favorite');
    expect(base.position).toBe('absolute');
    expect(fav.bottom).toBeDefined();
    expect(fav.left).toBeDefined();
    expect(fav.top).toBe('auto');
    expect(fav.right).toBe('auto');
  });

  it('heart is 3:1 or better on the badge in every theme, over a white or a black cover', () => {
    const mix = (a: string, b: string, t: number) => {
      const p = (h: string, i: number) => Number.parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
      return '#' + [0, 1, 2].map((i) => Math.round(p(a, i) * t + p(b, i) * (1 - t)).toString(16).padStart(2, '0')).join('');
    };
    for (const theme of THEME_NAMES) {
      const pal = THEME_PALETTE[theme];
      for (const cover of ['#ffffff', '#000000']) {
        const badge = mix(pal['inverse-surface'], cover, 0.88);
        expect(contrastRatio(pal['inverse-accent'], badge), `${theme} over ${cover}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('the heart is 3:1 or better in high contrast too', () => {
    for (const theme of THEME_NAMES) {
      const pal = { ...THEME_PALETTE[theme], ...HIGH_CONTRAST_PALETTE[theme] };
      for (const cover of ['#ffffff', '#000000']) {
        const a = pal['inverse-surface'];
        const mixed = '#' + [0, 1, 2].map((i) => Math.round(Number.parseInt(a.slice(1 + i * 2, 3 + i * 2), 16) * 0.88 + Number.parseInt(cover.slice(1 + i * 2, 3 + i * 2), 16) * 0.12).toString(16).padStart(2, '0')).join('');
        expect(contrastRatio(pal['inverse-accent'], mixed), `${theme} high over ${cover}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('the sample library has favorites for the gallery', () => {
    expect(SAMPLE_BOOKS.filter((b) => b.favorite).length).toBeGreaterThanOrEqual(2);
  });
});

describe('isAudioOnly', () => {
  const b = (over: Partial<BookDetail>): BookDetail => ({ ...book, ...over });
  it('needs audio and no pages and no text format', () => {
    expect(isAudioOnly(b({ audio: true, format: 'M4B' }))).toBe(true);
    expect(isAudioOnly(b({ audio: true }))).toBe(true);
    expect(isAudioOnly(b({ audio: true, pages: 300 }))).toBe(false);
    expect(isAudioOnly(b({ audio: true, format: 'epub' }))).toBe(false);
    expect(isAudioOnly(b({ audio: false, format: 'M4B' }))).toBe(false);
    expect(isAudioOnly(b({}))).toBe(false);
  });
  it('the explicit flag wins in both directions', () => {
    expect(isAudioOnly(b({ audio: true, pages: 300, audioOnly: true }))).toBe(true);
    expect(isAudioOnly(b({ audio: true, format: 'M4B', audioOnly: false }))).toBe(false);
  });
});

describe('BookDetailSheet for an audio-only book', () => {
  it('makes Listen the primary action and does not offer Read', () => {
    const onListen = vi.fn();
    render(<BookDetailSheet open book={SAMPLE_DETAIL_AUDIO} onClose={noop} onRead={noop} onListen={onListen} />);
    const dialog = screen.getByRole('dialog');
    const listen = within(dialog).getByRole('button', { name: /keep listening/i });
    expect(listen).toHaveClass('pn-btn--primary');
    expect(within(dialog).queryByRole('button', { name: /read/i })).toBeNull();
    fireEvent.click(listen);
    expect(onListen).toHaveBeenCalledTimes(1);
  });

  it('says Listen for a new book and Listen again for a finished one', () => {
    const { rerender } = render(<BookDetailSheet open book={{ ...SAMPLE_DETAIL_AUDIO, progress: 0 }} onClose={noop} onListen={noop} />);
    expect(screen.getByRole('button', { name: 'Listen' })).toHaveClass('pn-btn--primary');
    rerender(<BookDetailSheet open book={{ ...SAMPLE_DETAIL_AUDIO, progress: 1 }} onClose={noop} onListen={noop} />);
    expect(screen.getByRole('button', { name: 'Listen again' })).toHaveClass('pn-btn--primary');
  });

  it('keeps Read primary and Listen secondary for a book you can do both with', () => {
    render(<BookDetailSheet open book={SAMPLE_DETAIL} onClose={noop} onRead={noop} onListen={noop} />);
    expect(screen.getByRole('button', { name: /continue reading/i })).toHaveClass('pn-btn--primary');
    expect(screen.getByRole('button', { name: /keep listening/i })).toHaveClass('pn-btn--secondary');
  });

  it('audioOnly: false forces the reading layout, audioOnly: true the listening one', () => {
    const { rerender } = render(<BookDetailSheet open book={{ ...SAMPLE_DETAIL_AUDIO, audioOnly: false }} onClose={noop} onRead={noop} onListen={noop} />);
    expect(screen.getByRole('button', { name: /reading/i })).toBeInTheDocument();
    rerender(<BookDetailSheet open book={{ ...SAMPLE_DETAIL, audioOnly: true }} onClose={noop} onRead={noop} onListen={noop} />);
    expect(screen.queryByRole('button', { name: /reading/i })).toBeNull();
    expect(screen.getByRole('button', { name: /keep listening/i })).toHaveClass('pn-btn--primary');
  });

  it('an audio-only book without an onListen handler shows no action at all, and the favorite heart is on the cover', () => {
    render(<BookDetailSheet open book={{ ...SAMPLE_DETAIL_AUDIO, favorite: true }} onClose={noop} onRead={noop} />);
    expect(screen.queryByRole('button', { name: /listen|read/i })).toBeNull();
    expect(screen.getByRole('img', { name: 'Favorite' })).toBeInTheDocument();
  });

  it('a text book without audio never shows Listen', () => {
    render(<BookDetailSheet open book={{ ...SAMPLE_DETAIL, audio: false }} onClose={noop} onRead={noop} onListen={noop} />);
    expect(screen.queryByRole('button', { name: /listen/i })).toBeNull();
  });
});

describe('LibraryScreen empty state: emptyActions and starter both work', () => {
  const base = { filter: 'all', onFilterChange: noop, query: '', onQueryChange: noop, onOpenBook: noop, books: [] as BookSummary[] };
  const starter: StarterBookOffer = { title: 'Pride and Prejudice', author: 'Jane Austen', license: 'Public domain', provenance: 'Project Gutenberg, ebook 1342', onOpen: noop };

  it('emptyActions alone (the Library bot) shows its sample action next to Add', () => {
    render(<LibraryScreen {...base} onAdd={noop} emptyActions={<button type="button">Open a sample book</button>} />);
    expect(screen.getByRole('button', { name: 'Open a sample book' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /add books/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: 'Try a sample book' })).toBeNull();
  });

  it('starter alone shows the designed sample card', () => {
    render(<LibraryScreen {...base} onAdd={noop} starter={starter} />);
    expect(screen.getByRole('region', { name: 'Try a sample book' })).toBeInTheDocument();
  });

  it('both together show both, once each', () => {
    render(<LibraryScreen {...base} onAdd={noop} starter={starter} emptyActions={<button type="button">Open my own sample</button>} />);
    expect(screen.getAllByRole('button', { name: 'Open my own sample' })).toHaveLength(1);
    expect(screen.getAllByRole('region', { name: 'Try a sample book' })).toHaveLength(1);
  });
});
