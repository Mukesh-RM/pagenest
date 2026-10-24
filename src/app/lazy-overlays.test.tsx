import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { whenIdle } from './idle';

const mounted = vi.hoisted(() => ({ prompts: 0, detail: 0 }));
vi.mock('./components/PwaPromptsHost', () => ({
  PwaPromptsHost: () => {
    mounted.prompts += 1;
    return <p>prompts</p>;
  },
}));
vi.mock('./components/BookDetailHost', () => ({
  BookDetailHost: ({ opened }: { opened: unknown }) => {
    mounted.detail += 1;
    return <p>{opened ? 'detail open' : 'detail closed'}</p>;
  },
}));

import { LazyBookDetailHost } from './components/LazyBookDetailHost';
import { LazyPwaPrompts } from './components/LazyPwaPrompts';

type IdleWindow = { requestIdleCallback?: unknown; cancelIdleCallback?: unknown };
const w = window as unknown as IdleWindow;

describe('whenIdle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    delete w.requestIdleCallback;
    delete w.cancelIdleCallback;
  });

  it('uses requestIdleCallback when there is one, and can be cancelled', () => {
    const request = vi.fn(() => 7);
    const cancel = vi.fn();
    w.requestIdleCallback = request;
    w.cancelIdleCallback = cancel;
    const stop = whenIdle(() => undefined);
    expect(request).toHaveBeenCalledWith(expect.any(Function), { timeout: 3000 });
    stop();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it('falls back to a short timer where requestIdleCallback is missing', () => {
    const cb = vi.fn();
    const stop = whenIdle(cb);
    vi.advanceTimersByTime(1499);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
    const cb2 = vi.fn();
    whenIdle(cb2)();
    vi.advanceTimersByTime(5000);
    expect(cb2).not.toHaveBeenCalled();
    stop();
  });
});

describe('LazyPwaPrompts', () => {
  beforeEach(() => {
    mounted.prompts = 0;
  });
  afterEach(() => {
    delete w.requestIdleCallback;
  });

  it('renders nothing in the page flow and loads the prompts only when idle', async () => {
    let fire: () => void = () => undefined;
    w.requestIdleCallback = (cb: () => void) => {
      fire = cb;
      return 1;
    };
    const { container } = render(<LazyPwaPrompts />);
    expect(container).toBeEmptyDOMElement();
    expect(mounted.prompts).toBe(0);
    act(() => fire());
    expect(await screen.findByText('prompts')).toBeInTheDocument();
  });
});

describe('LazyBookDetailHost', () => {
  const props = (opened: unknown) =>
    ({ opened, onClose: vi.fn(), onRead: vi.fn(), onListen: vi.fn(), onRemoveConfirmed: vi.fn() }) as unknown as Parameters<
      typeof LazyBookDetailHost
    >[0];

  beforeEach(() => {
    mounted.detail = 0;
    w.requestIdleCallback = () => 1; // never fires: only a tap should load it
  });
  afterEach(() => {
    delete w.requestIdleCallback;
  });

  it('renders nothing until a book is opened, then loads the sheet and keeps it mounted for the close animation', async () => {
    const { container, rerender } = render(<LazyBookDetailHost {...props(undefined)} />);
    expect(container).toBeEmptyDOMElement();
    expect(mounted.detail).toBe(0);
    rerender(<LazyBookDetailHost {...props({ book: { id: 'b' } })} />);
    expect(await screen.findByText('detail open')).toBeInTheDocument();
    rerender(<LazyBookDetailHost {...props(undefined)} />);
    await waitFor(() => expect(screen.getByText('detail closed')).toBeInTheDocument());
  });

  it('is not a control: nothing to click before it loads', () => {
    render(<LazyBookDetailHost {...props(undefined)} />);
    expect(screen.queryByRole('button')).toBeNull();
    fireEvent.click(document.body);
  });
});
