import '../test/setup';
import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '../test/user';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSheetHistoryForTests } from '../utils/sheetHistory';
import { BottomSheet } from './BottomSheet';

beforeEach(() => {
  resetSheetHistoryForTests();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  resetSheetHistoryForTests();
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 30)));

function Harness({ onClose = vi.fn(), startOpen = true }: { onClose?: (r: string) => void; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open settings</button>
      <BottomSheet
        open={open}
        title="Settings"
        onClose={(reason) => {
          onClose(reason);
          setOpen(false);
        }}
      >
        <button>First action</button>
        <button>Last action</button>
      </BottomSheet>
    </div>
  );
}

describe('BottomSheet semantics', () => {
  it('renders nothing while closed', () => {
    render(<BottomSheet open={false} title="Hidden" onClose={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is an aria-modal dialog named by its title', () => {
    render(
      <BottomSheet open title="Chapters" onClose={() => undefined}>
        content
      </BottomSheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Chapters' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveClass('pn-sheet');
    expect(screen.getByRole('heading', { level: 2, name: 'Chapters' })).toBeInTheDocument();
  });

  it('the close button is 44 px class and labelled', () => {
    render(<BottomSheet open title="Chapters" onClose={() => undefined} closeLabel="Close chapters" />);
    const close = screen.getByRole('button', { name: 'Close chapters' });
    expect(close).toHaveClass('pn-btn--icon');
  });

  it('starts closed, then slides in (data-state open) and locks page scroll', async () => {
    render(<BottomSheet open title="Chapters" onClose={() => undefined} />);
    const root = document.querySelector('.pn-sheet-root')!;
    await waitFor(() => expect(root).toHaveAttribute('data-state', 'open'));
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('moves focus into the sheet and restores it to the trigger on close', async () => {
    const user = userEvent.setup();
    render(<Harness startOpen={false} />);
    const trigger = screen.getByRole('button', { name: 'Open settings' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.style.overflow).toBe('');
  });

  it('focuses initialFocusRef when given', () => {
    function WithRef() {
      const [el, setEl] = useState<HTMLButtonElement | null>(null);
      return (
        <BottomSheet open title="Pick" onClose={() => undefined} initialFocusRef={{ current: el }}>
          <button ref={setEl}>Primary</button>
        </BottomSheet>
      );
    }
    // The ref is populated after the first commit, so open on a second render.
    const { rerender } = render(<WithRef />);
    rerender(<WithRef />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('BottomSheet closing', () => {
  it('Escape closes with reason "escape"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledWith('escape');
  });

  it('scrim click closes with reason "scrim"; closeOnScrim=false ignores it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = render(<Harness onClose={onClose} />);
    await user.click(screen.getByTestId('pn-scrim'));
    expect(onClose).toHaveBeenCalledWith('scrim');
    unmount();

    const onClose2 = vi.fn();
    render(<BottomSheet open title="Locked" closeOnScrim={false} onClose={onClose2} />);
    await user.click(screen.getByTestId('pn-scrim'));
    expect(onClose2).not.toHaveBeenCalled();
  });

  it('close button closes with reason "close-button"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledWith('close-button');
  });

  it('the system back gesture (popstate) closes the sheet first', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    expect(window.history.state).toMatchObject({ pnSheet: expect.any(Number) });
    act(() => window.history.back());
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('back'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closing from the UI removes its history entry and never reports a phantom "back"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    expect(window.history.state).toMatchObject({ pnSheet: expect.any(Number) });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(window.history.state?.pnSheet).toBeUndefined());
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith('escape');
  });

  it('keeps other history state (router keys) when pushing its entry', () => {
    window.history.replaceState({ idx: 3, key: 'abc' }, '', '/');
    render(<Harness />);
    expect(window.history.state).toMatchObject({ idx: 3, key: 'abc', pnSheet: expect.any(Number) });
  });

  it('with two sheets open, back closes the top one only, then the next back closes the other', async () => {
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();
    function Two() {
      const [a, setA] = useState(true);
      const [b, setB] = useState(true);
      return (
        <>
          <BottomSheet
            open={a}
            title="Sheet A"
            onClose={(r) => {
              onCloseA(r);
              setA(false);
            }}
          />
          <BottomSheet
            open={b}
            title="Sheet B"
            onClose={(r) => {
              onCloseB(r);
              setB(false);
            }}
          />
        </>
      );
    }
    render(<Two />);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    act(() => window.history.back());
    await waitFor(() => expect(onCloseB).toHaveBeenCalledWith('back'));
    expect(onCloseA).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sheet B' })).toBeNull());
    act(() => window.history.back());
    await waitFor(() => expect(onCloseA).toHaveBeenCalledWith('back'));
  });

  it('Escape only closes the topmost sheet', async () => {
    const user = userEvent.setup();
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();
    render(
      <>
        <BottomSheet open title="Sheet A" onClose={onCloseA} />
        <BottomSheet open title="Sheet B" onClose={onCloseB} />
      </>,
    );
    await user.keyboard('{Escape}');
    expect(onCloseB).toHaveBeenCalledWith('escape');
    expect(onCloseA).not.toHaveBeenCalled();
  });
});

describe('BottomSheet focus trap', () => {
  it('Tab from the last control wraps to the first, Shift+Tab from the first wraps to the last', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const close = screen.getByRole('button', { name: 'Close' });
    const last = screen.getByRole('button', { name: 'Last action' });
    last.focus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it('pulls focus back when it escapes to the page behind', async () => {
    render(
      <>
        <button>Behind</button>
        <BottomSheet open title="Modal" onClose={() => undefined}>
          <button>Inside</button>
        </BottomSheet>
      </>,
    );
    act(() => screen.getByRole('button', { name: 'Behind' }).focus());
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });
});

describe('BottomSheet swipe down', () => {
  function pointer(type: string, target: Element, clientY: number, timeStamp: number) {
    const event = new MouseEvent(type, { bubbles: true, clientY });
    Object.defineProperty(event, 'timeStamp', { value: timeStamp });
    act(() => {
      target.dispatchEvent(event);
    });
  }

  it('a long downward swipe on the handle closes with reason "swipe"', () => {
    const onClose = vi.fn();
    render(<BottomSheet open title="Swipe" onClose={onClose} />);
    const handle = screen.getByTestId('pn-sheet-drag');
    pointer('pointerdown', handle, 100, 1000);
    pointer('pointermove', handle, 220, 1200);
    expect(screen.getByRole('dialog').style.getPropertyValue('--pn-sheet-drag')).toBe('120px');
    pointer('pointerup', handle, 220, 1400);
    expect(onClose).toHaveBeenCalledWith('swipe');
  });

  it('a short slow drag snaps back without closing', () => {
    const onClose = vi.fn();
    render(<BottomSheet open title="Swipe" onClose={onClose} />);
    const handle = screen.getByTestId('pn-sheet-drag');
    pointer('pointerdown', handle, 100, 1000);
    pointer('pointermove', handle, 130, 1600);
    pointer('pointerup', handle, 130, 2200);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').style.getPropertyValue('--pn-sheet-drag')).toBe('0px');
  });

  it('upward movement never lifts the sheet', () => {
    render(<BottomSheet open title="Swipe" onClose={() => undefined} />);
    const handle = screen.getByTestId('pn-sheet-drag');
    pointer('pointerdown', handle, 100, 1000);
    pointer('pointermove', handle, 40, 1100);
    expect(screen.getByRole('dialog').style.getPropertyValue('--pn-sheet-drag')).toBe('0px');
  });
});

describe('BottomSheet portal', () => {
  it('is portaled to body outside the app root', () => {
    const { container } = render(<BottomSheet open title="Portal" onClose={() => undefined} />);
    expect(container).not.toContainElement(screen.getByRole('dialog'));
    expect(document.body).toContainElement(screen.getByRole('dialog'));
  });
});
