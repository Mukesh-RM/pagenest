import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataClient } from '@/data/data-client';
import { setSetting } from '@/data/settings';
import { CLEANUP_IDLE_TIMEOUT_MS, scheduleStartupCleanup, startupCleanupDone, type StartupLog } from './startup';
import type { AppServices } from './services-context';
import { makeServices, renderApp, resetSettings } from './test-utils';

type Idle = { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => number } & Window;

/** A window whose idle callbacks the test fires by hand. */
function fakeWindow() {
  const queue: Array<() => void> = [];
  const requestIdleCallback = vi.fn((cb: () => void) => queue.push(cb));
  const win = { requestIdleCallback } as unknown as Idle;
  return { win, requestIdleCallback, fire: () => queue.splice(0).forEach((cb) => cb()) };
}

function fakeData(cleanupOrphans: () => Promise<unknown>): DataClient {
  return { books: { cleanupOrphans } } as unknown as DataClient;
}

const log = (): StartupLog & { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> } => ({ info: vi.fn(), warn: vi.fn() });

describe('scheduleStartupCleanup', () => {
  it('does nothing until the browser is idle, then calls cleanupOrphans exactly once', async () => {
    const cleanup = vi.fn(async () => ({ removedBookIds: [], freedBytes: 0 }));
    const data = fakeData(cleanup);
    const { win, requestIdleCallback, fire } = fakeWindow();
    const done = scheduleStartupCleanup(data, { win, log: log() });
    expect(cleanup).not.toHaveBeenCalled(); // not on the critical path
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: CLEANUP_IDLE_TIMEOUT_MS });
    fire();
    await done;
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: later calls (remounts, StrictMode) share the same run', async () => {
    const cleanup = vi.fn(async () => ({ removedBookIds: [], freedBytes: 0 }));
    const data = fakeData(cleanup);
    const { win, requestIdleCallback, fire } = fakeWindow();
    const a = scheduleStartupCleanup(data, { win, log: log() });
    const b = scheduleStartupCleanup(data, { win, log: log() });
    expect(b).toBe(a);
    fire();
    await a;
    scheduleStartupCleanup(data, { win, log: log() });
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('logs the typed error and carries on when the data layer refuses (cleanup-not-allowed)', async () => {
    const refused = Object.assign(new Error('refused'), { code: 'cleanup-not-allowed' });
    const l = log();
    const { win, fire } = fakeWindow();
    const done = scheduleStartupCleanup(
      fakeData(() => Promise.reject(refused)),
      { win, log: l },
    );
    fire();
    await expect(done).resolves.toBeUndefined();
    expect(l.info).toHaveBeenCalledWith(expect.stringContaining('skipped'), { code: 'cleanup-not-allowed' });
    expect(l.warn).not.toHaveBeenCalled();
  });

  it('logs any other failure as a warning with its code, and never rejects', async () => {
    const failed = Object.assign(new Error('disk'), { code: 'write-failed' });
    const l = log();
    const { win, fire } = fakeWindow();
    const done = scheduleStartupCleanup(
      fakeData(() => Promise.reject(failed)),
      { win, log: l },
    );
    fire();
    await expect(done).resolves.toBeUndefined();
    expect(l.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ code: 'write-failed' }));
  });

  it('reports what it removed', async () => {
    const l = log();
    const { win, fire } = fakeWindow();
    const done = scheduleStartupCleanup(
      fakeData(async () => ({ removedBookIds: ['x'], freedBytes: 10 })),
      { win, log: l },
    );
    fire();
    await done;
    expect(l.info).toHaveBeenCalledTimes(1);
  });

  it('falls back to a timer where requestIdleCallback does not exist', async () => {
    vi.useFakeTimers();
    try {
      const cleanup = vi.fn(async () => ({ removedBookIds: [], freedBytes: 0 }));
      const win = { setTimeout: window.setTimeout.bind(window) } as unknown as Idle;
      const done = scheduleStartupCleanup(fakeData(cleanup), { win, log: log() });
      expect(cleanup).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1000);
      await done;
      expect(cleanup).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('startupCleanupDone waits for the run, and resolves at once when none was scheduled', async () => {
    await expect(startupCleanupDone(fakeData(async () => undefined))).resolves.toBeUndefined();
    let release: () => void = () => undefined;
    const data = fakeData(() => new Promise((resolve) => (release = () => resolve({ removedBookIds: [], freedBytes: 0 }))));
    const { win, fire } = fakeWindow();
    scheduleStartupCleanup(data, { win, log: log() });
    fire();
    let finished = false;
    void startupCleanupDone(data).then(() => (finished = true));
    await Promise.resolve();
    expect(finished).toBe(false);
    release();
    await waitFor(() => expect(finished).toBe(true));
  });
});

describe('the running app', () => {
  let services: AppServices;
  beforeEach(() => {
    resetSettings();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    services.db.close();
  });

  it('calls cleanupOrphans once, after the first screen is up (also across StrictMode-style remounts)', async () => {
    const base = makeServices('startup-app');
    const spy = vi.spyOn(base.data.books, 'cleanupOrphans');
    services = base;
    await setSetting(services.db, 'onboardingDone', true);
    const { App } = await import('./App');
    const { render } = await import('@testing-library/react');
    const first = render(<App services={services} />);
    await screen.findByRole('heading', { level: 1, name: 'Library' });
    first.unmount();
    render(<App services={services} />);
    await screen.findByRole('heading', { level: 1, name: 'Library' });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1), { timeout: 4000 });
  });

  it('keeps the data layer out of the first-load path: App only imports the type of the data client', async () => {
    const { readFileSync } = await import('node:fs');
    const text = readFileSync('src/app/startup.ts', 'utf8');
    expect(text).not.toMatch(/from '@\/data\/books'/);
  });
});
