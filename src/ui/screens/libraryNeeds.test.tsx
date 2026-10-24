import '../test/setup';
import { fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ui from '..';
import { BookCard } from '../components/BookCard';
import { BookCover, MONOGRAM_COLORS, monogramIndex, monogramLetter } from '../components/BookCover';
import { SAMPLE_BOOKS, SAMPLE_DETAIL } from '../demo/sample-data';
import { declarationsFor, parseCss, readUiFile } from '../test/css';
import { installViewport } from '../test/viewport';
import { contrastRatio } from '../utils/wcag';
import { InstallHelpSheet } from '../components/InstallHelpSheet';
import { BookDetailSheet } from './BookDetailSheet';
import { OnboardingScreen } from './OnboardingScreen';
import { libraryColumns, libraryGridSpec, useLibraryGrid } from './libraryGrid';

const noop = () => undefined;
let viewport: ReturnType<typeof installViewport> | undefined;
afterEach(() => {
  viewport?.restore();
  viewport = undefined;
  document.documentElement.style.fontSize = '';
  vi.restoreAllMocks();
});

describe('useLibraryGrid is part of @/ui', () => {
  it('is exported from the lean barrel with its helpers', () => {
    expect(ui.useLibraryGrid).toBe(useLibraryGrid);
    expect(ui.libraryGridSpec).toBe(libraryGridSpec);
    expect(ui.libraryColumns).toBe(libraryColumns);
  });

  it('returns the spec for the current breakpoint, and follows a breakpoint change', () => {
    viewport = installViewport(390);
    const { result } = renderHook(({ view }) => useLibraryGrid(view), { initialProps: { view: 'grid' as const } });
    expect(result.current.spec).toMatchObject({ minRem: 9, gap: 16, rowGap: 24 });
    viewport.setWidth(1280);
    expect(result.current.spec).toMatchObject({ minRem: 11, gap: 20, rowGap: 32 });
    viewport.setWidth(1600);
    expect(result.current.spec).toMatchObject({ minRem: 12, gap: 24, rowGap: 40 });
  });

  it('columns(width) matches the CSS auto-fill count, and shrinks at 200% text', () => {
    viewport = installViewport(390);
    const { result } = renderHook(() => useLibraryGrid('grid'));
    // 358 px list at 16 px rem: floor((358 + 16) / (144 + 16)) = 2 columns.
    expect(result.current.columns(358)).toBe(2);
    document.documentElement.style.fontSize = '32px';
    expect(result.current.columns(358)).toBe(1);
  });

  it('the list view is one column on a phone and two from 1024 px', () => {
    viewport = installViewport(390);
    const { result } = renderHook(() => useLibraryGrid('list'));
    expect(result.current.columns(358)).toBe(1);
    viewport.setWidth(1280);
    expect(result.current.columns(900)).toBe(2);
  });
});

describe('monogram covers', () => {
  it('shows one capital letter from the title and no author text', () => {
    const { container } = render(<BookCover title="the orchard keeper" author="Ana Lindqvist" monogram />);
    const tile = container.querySelector('.pn-cover--monogram');
    expect(tile).not.toBeNull();
    expect(tile!.textContent).toBe('T');
    expect(container).not.toHaveTextContent('Ana');
    expect(container.querySelector('.pn-cover__letter')).toHaveAttribute('aria-hidden', 'true');
    expect(tile).toHaveAttribute('aria-hidden', 'true');
  });

  it('takes the first letter or digit, skipping quotes and marks, and keeps non-Latin letters', () => {
    expect(monogramLetter('  “Ñandú” al sol')).toBe('Ñ');
    expect(monogramLetter('1984')).toBe('1');
    expect(monogramLetter('夜の鳥')).toBe('夜');
    expect(monogramLetter('—')).toBe('');
  });

  it('a title with no letter falls back to the title card, never an empty tile', () => {
    const { container } = render(<BookCover title="—" monogram />);
    expect(container.querySelector('.pn-cover--monogram')).toBeNull();
    expect(container.querySelector('.pn-cover--generated')).not.toBeNull();
  });

  it('the tile color is deterministic from the title and uses the checked palette', () => {
    const a = render(<BookCover title="Nightjar" monogram />);
    const style = (a.container.querySelector('.pn-cover--monogram') as HTMLElement).getAttribute('style');
    a.unmount();
    const b = render(<BookCover title="Nightjar" monogram />);
    expect((b.container.querySelector('.pn-cover--monogram') as HTMLElement).getAttribute('style')).toBe(style);
    const pair = MONOGRAM_COLORS[monogramIndex('Nightjar')]!;
    expect(style).toContain(pair.background);
    expect(style).toContain(pair.foreground);
  });

  it('spreads different titles over several tiles', () => {
    const used = new Set(SAMPLE_BOOKS.concat(SAMPLE_BOOKS.map((b) => ({ ...b, title: `${b.title} II` }))).map((b) => monogramIndex(b.title)));
    expect(used.size).toBeGreaterThan(3);
  });

  it('every tile has 7:1 or better, so it is AA in all four themes and in high contrast', () => {
    for (const { background, foreground } of MONOGRAM_COLORS) {
      expect(contrastRatio(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(7);
    }
  });

  it('a BookCard uses the monogram when there is no cover, and the image when there is one', () => {
    const { container, rerender } = render(<BookCard book={{ id: 'm', title: 'Nightjar', author: 'Priya Raman', progress: 0.3 }} onOpen={noop} />);
    expect(container.querySelector('.pn-cover--monogram')?.textContent).toBe('N');
    rerender(<BookCard book={{ id: 'm', title: 'Nightjar', author: 'Priya Raman', progress: 0.3, coverUrl: 'data:image/png;base64,AAAA' }} onOpen={noop} />);
    expect(container.querySelector('.pn-cover--monogram')).toBeNull();
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('a broken cover image falls back to the monogram on a card', () => {
    const { container } = render(<BookCard book={{ id: 'm', title: 'Nightjar', progress: 0, coverUrl: 'data:image/png;base64,AAAA' }} onOpen={noop} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('.pn-cover--monogram')?.textContent).toBe('N');
  });

  it('sits with the favorite and the other badges: the letter is centered, the badges are in the corners', () => {
    const { container } = render(<BookCard book={{ id: 'm', title: 'Nightjar', author: 'Priya Raman', progress: 1, audio: true, favorite: true }} onOpen={noop} />);
    expect(screen.getByRole('img', { name: 'Favorite' })).toBeInTheDocument();
    expect(container.querySelectorAll('.pn-bookcard__badge')).toHaveLength(3);
    const rules = parseCss(readUiFile('styles/components.css'));
    const letter = declarationsFor(rules, '.pn-cover__letter');
    const tile = declarationsFor(rules, '.pn-cover--monogram');
    expect(tile['place-items']).toBe('center');
    expect(letter['position']).toBeUndefined();
    // The favorite badge is anchored bottom-left; the letter has a fixed size well inside the tile.
    expect(parseFloat(letter['font-size']!)).toBeLessThanOrEqual(50);
  });

  it('draws a frame in high contrast so a dark tile on a black page still reads as a cover', () => {
    const css = readUiFile('styles/components.css');
    expect(css).toMatch(/\[data-contrast="high"\] \.pn-cover::after/);
    expect(css).toMatch(/prefers-contrast: more\)[\s\S]*?\.pn-cover::after/);
  });
});

describe('covers show whole', () => {
  it('object-fit is contain by default, with an explicit fill opt-in', () => {
    const rules = parseCss(readUiFile('styles/components.css'));
    expect(declarationsFor(rules, '.pn-cover__img')['object-fit']).toBe('contain');
    expect(declarationsFor(rules, '.pn-cover__img--fill')['object-fit']).toBe('cover');
  });

  it('keeps the 2:3 box (no layout shift) and a neutral tile behind the image', () => {
    const rules = parseCss(readUiFile('styles/components.css'));
    expect(declarationsFor(rules, '.pn-cover')['aspect-ratio']).toMatch(/2\s*\/\s*3/);
    expect(declarationsFor(rules, '.pn-cover')['background']).toBeTruthy();
  });

  it('fit="cover" adds the fill class; the default does not', () => {
    const { container, rerender } = render(<BookCover title="T" src="data:image/png;base64,AAAA" />);
    expect(container.querySelector('img')).not.toHaveClass('pn-cover__img--fill');
    rerender(<BookCover title="T" src="data:image/png;base64,AAAA" fit="cover" />);
    expect(container.querySelector('img')).toHaveClass('pn-cover__img--fill');
  });
});

describe('BookDetailSheet onEdit', () => {
  const sheet = (props: Partial<React.ComponentProps<typeof BookDetailSheet>>) => render(<BookDetailSheet open book={SAMPLE_DETAIL} onClose={noop} {...props} />);

  it('has no menu at all without onEdit or onRemove', () => {
    sheet({});
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull();
  });

  it('with only onRemove there is no Edit details row', () => {
    sheet({ onRemove: noop });
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.queryByRole('menuitem', { name: 'Edit details' })).toBeNull();
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
  });

  it('puts Edit details before Remove, and calls onEdit with the book', () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    sheet({ onEdit, onRemove });
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    const rows = screen.getAllByRole('menuitem');
    expect(rows.map((r) => r.textContent)).toEqual(['Edit details', 'Remove from library']);
    expect(rows[0]).not.toHaveClass('pn-overflow__item--danger');
    expect(rows[1]).toHaveClass('pn-overflow__item--danger');
    fireEvent.click(rows[0]!);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0]![0]).toMatchObject({ id: SAMPLE_DETAIL.id });
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('onEdit alone gives a one-row menu', () => {
    sheet({ onEdit: noop });
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getAllByRole('menuitem').map((r) => r.textContent)).toEqual(['Edit details']);
  });

  it('works by keyboard: ArrowDown opens on Edit, arrows move to Remove, Escape closes and returns focus', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onClose = vi.fn();
    sheet({ onEdit, onRemove: noop, onClose });
    const button = screen.getByRole('button', { name: 'More options' });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    button.focus();
    await user.keyboard('{ArrowDown}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog');
    const edit = within(dialog).getByRole('menuitem', { name: 'Edit details' });
    expect(edit).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(within(dialog).getByRole('menuitem', { name: 'Remove from library' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(edit).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();
    // The first Esc only closed the menu; the sheet is still open.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    expect(onEdit).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledWith('escape');
  });
});

describe('Onboarding fills the card', () => {
  const props = { step: 0, onNext: noop, onBack: noop, onSkip: noop, onDone: noop, look: <p>Look</p> } as const;
  it.each([0, 1, 2])('step %i has a picture panel and a content column, with the heading inside the content', (step) => {
    const { container } = render(<OnboardingScreen {...props} step={step} />);
    const card = container.querySelector('.pn-onb__card')!;
    expect(card.children).toHaveLength(2);
    expect(card.children[0]).toHaveClass('pn-onb__hero');
    expect(card.children[1]).toHaveClass('pn-onb__content');
    expect(within(card.children[1] as HTMLElement).getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('the picture panel absorbs spare height and the tablet layout is two columns with no flex-start gap', () => {
    const rules = parseCss(readUiFile('styles/surfaces.css'));
    expect(declarationsFor(rules, '.pn-onb__hero')['flex']).toMatch(/^1 1/);
    const css = readUiFile('styles/surfaces.css');
    expect(css).toMatch(/@media \(min-width: 768px\) \{[\s\S]*?\.pn-onb__card \{[^}]*flex-direction: row/);
    expect(css).not.toMatch(/\.pn-onb__card \{[^}]*justify-content: flex-start/);
  });
});

describe('Install help says offline once', () => {
  it('has the word once per state', () => {
    for (const offlineReady of [false, true]) {
      const { container, unmount } = render(<InstallHelpSheet open onClose={noop} offlineReady={offlineReady} />);
      const status = container.ownerDocument.querySelector('.pn-install-help__status')!;
      expect(status.textContent!.match(/offline/gi)).toHaveLength(1);
      unmount();
    }
  });
});
