import { beforeEach, vi } from 'vitest';
import { BACK_DEPTH_KEY, BackStack, type HistoryHost } from './back-stack';

/**
 * A scripted browser history. `go()` is asynchronous like in a real browser:
 * the move only happens when `settle()` runs, so tests can check what happens
 * between a call and its popstate.
 */
class FakeHost implements HistoryHost {
  entries: { state: unknown }[] = [{ state: null }];
  index = 0;
  private pending: number[] = [];
  private listeners = new Set<(e: PopStateEvent) => void>();
  readonly pushes: unknown[] = [];
  readonly goCalls: number[] = [];

  readonly history = {
    pushState: (state: unknown, _unused?: string): void => {
      this.entries.splice(this.index + 1);
      this.entries.push({ state });
      this.index += 1;
      this.pushes.push(state);
    },
    go: (delta: number): void => {
      this.goCalls.push(delta);
      this.pending.push(delta);
    },
    get state(): unknown {
      return host.entries[host.index]?.state ?? null;
    },
  };

  addEventListener(_type: 'popstate', listener: (e: PopStateEvent) => void): void {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'popstate', listener: (e: PopStateEvent) => void): void {
    this.listeners.delete(listener);
  }

  /** Apply queued moves, firing popstate for each. */
  settle(): void {
    while (this.pending.length > 0) {
      const delta = this.pending.shift() as number;
      this.index = Math.min(this.entries.length - 1, Math.max(0, this.index + delta));
      const state = this.entries[this.index]?.state ?? null;
      for (const l of [...this.listeners]) l({ state } as PopStateEvent);
    }
  }

  /** The user's back gesture. */
  userBack(): void {
    this.history.go(-1);
    this.settle();
  }
  userForward(): void {
    this.history.go(1);
    this.settle();
  }
  /** A router navigation to a new screen (no depth marker). */
  navigate(): void {
    this.history.pushState({ idx: this.index + 1 }, '');
  }
  get depth(): number {
    const s = this.entries[this.index]?.state as Record<string, unknown> | null;
    return typeof s?.[BACK_DEPTH_KEY] === 'number' ? (s[BACK_DEPTH_KEY] as number) : 0;
  }
}

let host: FakeHost;
let stack: BackStack;

const tick = (): Promise<void> => Promise.resolve();

beforeEach(() => {
  host = new FakeHost();
  stack = new BackStack(host);
  stack.attach();
});

describe('BackStack: one sheet', () => {
  it('adds one history entry when a sheet opens, in one microtask', async () => {
    stack.push(() => undefined);
    expect(host.pushes).toHaveLength(0);
    await tick();
    expect(host.pushes).toHaveLength(1);
    expect(host.depth).toBe(1);
    expect(host.entries).toHaveLength(2);
  });

  it('closes the sheet on the back gesture and stays on the same screen', async () => {
    const onClose = vi.fn();
    stack.push(onClose);
    await tick();
    host.userBack();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(stack.size).toBe(0);
    expect(host.index).toBe(0);
    expect(host.goCalls).toEqual([-1]);
  });

  it('removes its entry when closed in code, without calling onClose', async () => {
    const onClose = vi.fn();
    const token = stack.push(onClose);
    await tick();
    stack.release(token);
    await tick();
    expect(host.goCalls).toEqual([-1]);
    host.settle();
    expect(onClose).not.toHaveBeenCalled();
    expect(host.index).toBe(0);
    expect(host.depth).toBe(0);
    expect(stack.size).toBe(0);
  });

  it('can open again after closing in code, with no leftover history', async () => {
    const first = stack.push(() => undefined);
    await tick();
    stack.release(first);
    await tick();
    host.settle();
    const onClose = vi.fn();
    stack.push(onClose);
    await tick();
    expect(host.depth).toBe(1);
    host.userBack();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(host.index).toBe(0);
  });

  it('keeps the router state already on the current entry', async () => {
    host.entries[0] = { state: { usr: null, key: 'k', idx: 0 } };
    stack.push(() => undefined);
    await tick();
    expect(host.pushes[0]).toEqual({ usr: null, key: 'k', idx: 0, [BACK_DEPTH_KEY]: 1 });
  });

  it('ignores releasing a token twice, or one it does not know', async () => {
    const token = stack.push(() => undefined);
    await tick();
    stack.release(token);
    stack.release(token);
    stack.release({ id: 999 });
    await tick();
    expect(host.goCalls).toEqual([-1]);
  });

  it('stops listening after detach', async () => {
    const detach = stack.attach();
    const onClose = vi.fn();
    stack.push(onClose);
    await tick();
    // attach() registers the same bound handler each time, so one detach stops it
    detach();
    host.userBack();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('BackStack: nested sheets', () => {
  it('closes the topmost sheet first, then the one below', async () => {
    const closed: string[] = [];
    stack.push(() => closed.push('A'));
    stack.push(() => closed.push('B'));
    await tick();
    expect(host.depth).toBe(2);
    host.userBack();
    expect(closed).toEqual(['B']);
    host.userBack();
    expect(closed).toEqual(['B', 'A']);
    expect(host.index).toBe(0);
  });

  it('closing the top in code leaves the lower sheet open and history in line', async () => {
    const closed: string[] = [];
    stack.push(() => closed.push('A'));
    const b = stack.push(() => closed.push('B'));
    await tick();
    stack.release(b);
    await tick();
    host.settle();
    expect(closed).toEqual([]);
    expect(host.depth).toBe(1);
    host.userBack();
    expect(closed).toEqual(['A']);
    expect(host.index).toBe(0);
  });

  it('closing the lower sheet in code keeps the upper one, and back still closes it', async () => {
    const closed: string[] = [];
    const a = stack.push(() => closed.push('A'));
    stack.push(() => closed.push('B'));
    await tick();
    stack.release(a);
    await tick();
    host.settle();
    expect(host.depth).toBe(1);
    expect(stack.size).toBe(1);
    host.userBack();
    expect(closed).toEqual(['B']);
    expect(host.index).toBe(0);
  });

  it('opens two sheets in the same tick with two entries', async () => {
    stack.push(() => undefined);
    stack.push(() => undefined);
    await tick();
    expect(host.pushes).toHaveLength(2);
  });

  it('closes both with one multi-step jump back', async () => {
    const closed: string[] = [];
    stack.push(() => closed.push('A'));
    stack.push(() => closed.push('B'));
    await tick();
    host.history.go(-2);
    host.settle();
    expect(closed).toEqual(['B', 'A']);
    expect(host.index).toBe(0);
  });
});

describe('BackStack: StrictMode and rapid changes', () => {
  it('a sheet released and registered again in the same tick causes no history change', async () => {
    const first = stack.push(() => undefined);
    stack.release(first);
    stack.push(() => undefined);
    await tick();
    expect(host.pushes).toHaveLength(1);
    expect(host.goCalls).toEqual([]);
    expect(host.depth).toBe(1);
  });

  it('the same sequence after the sheet was already open leaves history unchanged', async () => {
    const first = stack.push(() => undefined);
    await tick();
    stack.release(first);
    stack.push(() => undefined);
    await tick();
    expect(host.pushes).toHaveLength(1);
    expect(host.goCalls).toEqual([]);
  });

  it('opening and closing in one tick does nothing to history', async () => {
    const token = stack.push(() => undefined);
    stack.release(token);
    await tick();
    expect(host.pushes).toHaveLength(0);
    expect(host.goCalls).toEqual([]);
  });
});

describe('BackStack: screens', () => {
  it('closes the sheet first; only the next back gesture leaves the screen', async () => {
    const onClose = vi.fn();
    host.navigate(); // screen 2
    stack.push(onClose);
    await tick();
    expect(host.index).toBe(2);
    host.userBack();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(host.index).toBe(1); // still on screen 2
    host.userBack();
    expect(host.index).toBe(0); // now on screen 1
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(host.goCalls).toEqual([-1, -1]);
  });

  it('dropAll closes every sheet without changing history', async () => {
    const closed: string[] = [];
    stack.push(() => closed.push('A'));
    stack.push(() => closed.push('B'));
    await tick();
    const goCalls = host.goCalls.length;
    stack.dropAll();
    await tick();
    expect(closed).toEqual(['B', 'A']);
    expect(stack.size).toBe(0);
    expect(host.goCalls).toHaveLength(goCalls);
  });

  it('after a route change, going back over the old sheet entries skips them', async () => {
    stack.push(() => undefined);
    await tick();
    host.navigate(); // router pushes a new screen on top of the sheet entry
    stack.dropAll();
    await tick();
    expect(host.index).toBe(2);
    host.userBack(); // lands on the stale sheet entry (depth 1, no sheet)
    host.settle(); // the automatic extra step back
    expect(host.index).toBe(0);
    expect(stack.size).toBe(0);
  });

  it('going forward into a stale sheet entry steps back over it', async () => {
    const token = stack.push(() => undefined);
    await tick();
    host.userBack(); // closes sheet; the entry stays ahead as a forward entry
    expect(stack.size).toBe(0);
    host.userForward();
    host.settle();
    expect(host.index).toBe(0);
    expect(host.depth).toBe(0);
    stack.release(token);
  });

  it('a back gesture with no sheet open does nothing to the stack', () => {
    host.userBack();
    expect(stack.size).toBe(0);
    expect(host.goCalls).toEqual([-1]);
  });
});
