import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The tab modules are replaced so the test can see exactly when each one is requested.
const loaded = vi.hoisted(() => ({ stats: 0, settings: 0, collections: 0 }));
vi.mock('./pages/StatsPage', () => {
  loaded.stats += 1;
  return { StatsPage: () => null };
});
vi.mock('./pages/SettingsPage', () => {
  loaded.settings += 1;
  return { SettingsPage: () => null };
});
vi.mock('./pages/CollectionsPage', () => {
  loaded.collections += 1;
  return { CollectionsPage: () => null };
});

import { preloadScreensWhenIdle } from './screens';

type IdleWindow = { requestIdleCallback?: unknown; cancelIdleCallback?: unknown };

describe('preloadScreensWhenIdle', () => {
  const w = window as unknown as IdleWindow;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    delete w.requestIdleCallback;
    delete w.cancelIdleCallback;
  });

  it('waits for the browser to be idle, then loads the screens (and asks for them to be done within 3 s)', async () => {
    let run: () => void = () => {};
    const request = vi.fn((cb: () => void, _options?: { timeout: number }) => {
      run = cb;
      return 7;
    });
    w.requestIdleCallback = request;
    preloadScreensWhenIdle(['stats']);
    expect(request.mock.calls[0]?.[1]).toEqual({ timeout: 3000 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(loaded.stats).toBe(0); // nothing starts until the browser says it is idle
    run();
    await vi.waitFor(() => expect(loaded.stats).toBe(1));
  });

  it('cancelling before idle loads nothing', async () => {
    const cancel = vi.fn();
    w.requestIdleCallback = () => 9;
    w.cancelIdleCallback = cancel;
    const stop = preloadScreensWhenIdle(['collections']);
    stop();
    expect(cancel).toHaveBeenCalledWith(9);
    await vi.advanceTimersByTimeAsync(5000);
    expect(loaded.collections).toBe(0);
  });

  it('without requestIdleCallback it waits 1.5 s instead', async () => {
    delete w.requestIdleCallback;
    preloadScreensWhenIdle(['settings']);
    await vi.advanceTimersByTimeAsync(1400);
    expect(loaded.settings).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    await vi.waitFor(() => expect(loaded.settings).toBe(1));
  });

  it('the timer version can be cancelled too', async () => {
    delete w.requestIdleCallback;
    const stop = preloadScreensWhenIdle(['collections']);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(loaded.collections).toBe(0);
  });
});
