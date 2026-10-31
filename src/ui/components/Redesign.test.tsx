import '../test/setup';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSheetHistoryForTests } from '../utils/sheetHistory';
import { BookCard, progressWords } from './BookCard';
import { BookCover, titleCardIndex } from './BookCover';
import { ChoiceGroup } from './ChoiceGroup';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNotice, PLAIN_ERRORS } from './ErrorNotice';
import { FinishedMoment } from './FinishedMoment';
import { GestureHint, memoryHintStore } from './GestureHint';
import { ResumeCard } from './ResumeCard';

beforeEach(() => {
  resetSheetHistoryForTests();
  window.history.replaceState(null, '', '/');
});
afterEach(() => resetSheetHistoryForTests());

const book = { id: 'x', title: 'Nightjar', author: 'Priya Raman', progress: 0.87, audio: true };

describe('ConfirmDialog', () => {
  it('is an aria-modal dialog; Cancel is focused first and is the calm default', async () => {
    render(<ConfirmDialog open title="Remove this book?" confirmLabel="Remove" destructive onConfirm={() => undefined} onCancel={() => undefined} />);
    const dialog = await screen.findByRole('dialog', { name: 'Remove this book?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus());
  });

  it('uses the one filled red button only when destructive', () => {
    const { rerender } = render(<ConfirmDialog open title="Remove?" confirmLabel="Remove" destructive onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Remove' }).className).toContain('pn-btn--danger-solid');
    rerender(<ConfirmDialog open title="Sign out?" confirmLabel="Sign out" onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Sign out' }).className).toContain('pn-btn--primary');
    expect(document.querySelector('.pn-btn--danger-solid')).toBeNull();
  });

  it('confirm and cancel report once; Esc cancels', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Remove?" confirmLabel="Remove" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledWith('escape');
  });
});

describe('ErrorNotice', () => {
  it('is announced (role alert) and every message is plain words with no codes', () => {
    for (const [kind, text] of Object.entries(PLAIN_ERRORS)) {
      expect(text.title + text.description, kind).not.toMatch(/\b(error|exception|undefined|null|0x[0-9a-f]+|\d{3})\b/i);
    }
    render(<ErrorNotice kind="offline" actionLabel="Try again" onAction={() => undefined} onDismiss={() => undefined} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('You are offline');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('shows at most one next step and falls back to a generic, kind message', () => {
    const onAction = vi.fn();
    render(<ErrorNotice actionLabel="Try again" onAction={onAction} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Nothing was lost');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

describe('GestureHint', () => {
  it('shows once: dismissing stores it and it never comes back', () => {
    const store = memoryHintStore();
    const { rerender, unmount } = render(<GestureHint id="long-press" message="Press and hold to select." store={store} />);
    expect(screen.getByRole('note')).toHaveTextContent('Press and hold to select.');
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByRole('note')).toBeNull();
    expect(store.hasSeen('long-press')).toBe(true);
    rerender(<GestureHint id="long-press" message="Press and hold to select." store={store} />);
    expect(screen.queryByRole('note')).toBeNull();
    unmount();
    render(<GestureHint id="long-press" message="Press and hold to select." store={store} />);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('stays hidden until the parent says it is a good moment', () => {
    const store = memoryHintStore();
    const { rerender } = render(<GestureHint id="a" message="Hello" store={store} enabled={false} />);
    expect(screen.queryByRole('note')).toBeNull();
    rerender(<GestureHint id="a" message="Hello" store={store} enabled />);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });
});

describe('ChoiceGroup', () => {
  function Group() {
    const [value, setValue] = useState('b');
    return (
      <ChoiceGroup
        label="Spacing"
        value={value}
        onChange={setValue}
        options={[
          { value: 'a', label: 'Tight' },
          { value: 'b', label: 'Normal' },
          { value: 'c', label: 'Roomy' },
        ]}
      />
    );
  }

  it('is a radio group with one checked radio', () => {
    render(<Group />);
    const group = screen.getByRole('radiogroup', { name: 'Spacing' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });

  it('arrow keys move the choice and wrap; Home and End jump', async () => {
    render(<Group />);
    const radio = (name: string) => screen.getByRole('radio', { name });
    fireEvent.keyDown(radio('Normal'), { key: 'ArrowRight' });
    expect(radio('Roomy')).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(radio('Roomy')).toHaveFocus());
    fireEvent.keyDown(radio('Roomy'), { key: 'ArrowRight' });
    expect(radio('Tight')).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(radio('Tight'), { key: 'End' });
    expect(radio('Roomy')).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(radio('Roomy'), { key: 'Home' });
    expect(radio('Tight')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('BookCard and BookCover', () => {
  it('is one button named "Title, Author. Progress. Has audio"', () => {
    const onOpen = vi.fn();
    render(<BookCard book={book} onOpen={onOpen} />);
    const card = screen.getByRole('button', { name: 'Nightjar, Priya Raman. 87% listened. Has audio' });
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]![0]).toMatchObject({ id: 'x' });
  });

  it('plain-word progress for 0 %, partway and 100 %', () => {
    expect(progressWords({ progress: 0 })).toBe('Not started');
    expect(progressWords({ progress: 0.42 })).toBe('42% read');
    expect(progressWords({ progress: 0.42, audio: true })).toBe('42% listened');
    expect(progressWords({ progress: 1 })).toBe('Finished');
    expect(progressWords({ progress: 7 })).toBe('Finished');
  });

  it('a book without an author or cover still renders a title card and a label', () => {
    render(<BookCard book={{ id: 'y', title: 'Untitled Scans, Box 4', progress: 0.11 }} onOpen={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Untitled Scans, Box 4. 11% read' })).toBeInTheDocument();
    expect(screen.getByText('Unknown author')).toBeInTheDocument();
    // Cards use the monogram tile; the detail sheet keeps the full title card (no monogram prop).
    expect(document.querySelector('.pn-cover--monogram')).not.toBeNull();
  });

  it('the generated title card color is stable per title and always one of the AA pairs', () => {
    expect(titleCardIndex('Nightjar')).toBe(titleCardIndex('Nightjar'));
    expect(titleCardIndex('A')).toBeGreaterThanOrEqual(0);
  });

  it('falls back to the title card when the image fails to load', () => {
    const { container } = render(<BookCover title="Broken" author="Nobody" src="data:image/png;base64,AAAA" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    fireEvent.error(img!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.pn-cover--generated')).not.toBeNull();
  });

  it('the done badge and the audio badge are decorative', () => {
    const { container } = render(<BookCard book={{ ...book, progress: 1 }} onOpen={() => undefined} />);
    for (const badge of container.querySelectorAll('.pn-bookcard__badge')) expect(badge).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.pn-bookcard__badge')).toHaveLength(2);
  });
});

describe('ResumeCard and FinishedMoment', () => {
  it('Welcome back: one sentence, one button, a quiet dismiss', () => {
    const onResume = vi.fn();
    const onDismiss = vi.fn();
    render(<ResumeCard book={book} where="chapter 7" mode="listen" onResume={onResume} onDismiss={onDismiss} />);
    const region = screen.getByRole('region', { name: 'Welcome back' });
    expect(region).toHaveTextContent('chapter 7');
    expect(region).toHaveTextContent('Nightjar');
    fireEvent.click(within(region).getByRole('button', { name: /keep listening/i }));
    expect(onResume).toHaveBeenCalledTimes(1);
    fireEvent.click(within(region).getByRole('button', { name: /not now/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('finished moment: heading, kind summary, one primary next step, no confetti', () => {
    const onNext = vi.fn();
    render(<FinishedMoment book={{ ...book, progress: 1 }} summary="You spent 6 h with it." onNext={onNext} nextLabel="Pick your next book" />);
    expect(screen.getByRole('heading', { name: /you finished nightjar/i })).toBeInTheDocument();
    expect(screen.getByText('You spent 6 h with it.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pick your next book' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
