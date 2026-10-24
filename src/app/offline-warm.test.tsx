import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SampleBookProvider } from './contracts';
import { currentWarmEnv, resetWarmForTests, runWarmTasks, scheduleOfflineWarm, WARM_DELAY_MS, type WarmEnv } from './offline-warm';
import { offlineWarmTasks } from './offline-assets';
import { makeServices, renderApp, resetSettings } from './test-utils';
import { setSetting } from '@/data/settings';

const GOOD: WarmEnv = { online: true, saveData: false, swControlled: true };

describe('scheduleOfflineWarm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetWarmForTests();
  });
  afterEach(() => vi.useRealTimers());

  const task = () => {
    const run = vi.fn(async () => undefined);
    return { run, list: [{ name: 'a', run }] };
  };

  it('waits out the delay, then runs the tasks once the browser is idle', async () => {
    const t = task();
    scheduleOfflineWarm(
      () => t.list,
      () => GOOD,
    );
    await vi.advanceTimersByTimeAsync(WARM_DELAY_MS - 1);
    expect(t.run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.run).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['offline', { ...GOOD, online: false }],
    ['asked to save data', { ...GOOD, saveData: true }],
    ['no service worker in control (nothing would keep the files)', { ...GOOD, swControlled: false }],
  ])('does nothing when %s', async (_name, env) => {
    const t = task();
    scheduleOfflineWarm(
      () => t.list,
      () => env,
    );
    await vi.advanceTimersByTimeAsync(20_000);
    expect(t.run).not.toHaveBeenCalled();
  });

  it('runs once per page load, even when scheduled again', async () => {
    const t = task();
    scheduleOfflineWarm(
      () => t.list,
      () => GOOD,
    );
    await vi.advanceTimersByTimeAsync(20_000);
    scheduleOfflineWarm(
      () => t.list,
      () => GOOD,
    );
    await vi.advanceTimersByTimeAsync(20_000);
    expect(t.run).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled (leaving the Library before the delay is over)', async () => {
    const t = task();
    const cancel = scheduleOfflineWarm(
      () => t.list,
      () => GOOD,
    );
    cancel();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(t.run).not.toHaveBeenCalled();
  });

  it('runs tasks one after the other and skips a failed one without throwing', async () => {
    const order: string[] = [];
    const done = await runWarmTasks([
      { name: 'one', run: async () => void order.push('one') },
      { name: 'broken', run: async () => Promise.reject(new Error('offline')) },
      { name: 'two', run: async () => void order.push('two') },
    ]);
    expect(done).toEqual(['one', 'two']);
    expect(order).toEqual(['one', 'two']);
  });

  it('reads the real environment from the browser (jsdom: online, no service worker)', () => {
    expect(currentWarmEnv()).toEqual({ online: true, saveData: false, swControlled: false });
  });
});

describe('what is warmed', () => {
  const provider = (available: boolean): SampleBookProvider =>
    ({ info: { title: 't', author: 'a', license: 'l', provenance: 'p' }, available: () => available, importSample: vi.fn() }) as SampleBookProvider;

  afterEach(() => vi.unstubAllGlobals());

  it('is the sample book, fetched from our own origin and read through, only when the sample is available', async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array(4)));
    vi.stubGlobal('fetch', fetchMock);
    expect(offlineWarmTasks({})).toEqual([]);
    expect(offlineWarmTasks({ sampleBook: provider(false) })).toEqual([]);
    const tasks = offlineWarmTasks({ sampleBook: provider(true) });
    expect(tasks.map((t) => t.name)).toEqual(['sample-book']);
    await tasks[0]?.run();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toMatch(/^https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(url).toMatch(/peter-rabbit/);
    expect(init.credentials).toBe('same-origin');
  });

  it('reports a failed download as a failure, so it is skipped quietly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no', { status: 404 })),
    );
    const tasks = offlineWarmTasks({ sampleBook: provider(true) });
    await expect(tasks[0]?.run()).rejects.toThrow(/404/);
  });
});

describe('Library route', () => {
  beforeEach(() => {
    resetSettings();
    localStorage.clear();
    resetWarmForTests();
  });

  it('schedules the warm-up only once the Library is drawn, and the Library looks the same with it (it draws nothing)', async () => {
    const services = makeServices('offline-warm');
    await setSetting(services.db, 'onboardingDone', true);
    const timeout = vi.spyOn(window, 'setTimeout');
    const { container } = renderApp(services);
    await screen.findByRole('heading', { level: 1, name: 'Library' });
    expect(timeout.mock.calls.some(([, ms]) => ms === WARM_DELAY_MS)).toBe(true);
    expect(container.querySelectorAll('[data-offline-warm]').length).toBe(0);
    timeout.mockRestore();
    services.db.close();
  });
});
