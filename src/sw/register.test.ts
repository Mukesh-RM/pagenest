import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Options = { immediate?: boolean; onNeedRefresh?: () => void; onOfflineReady?: () => void };
const captured: { options?: Options; updateSW: ReturnType<typeof vi.fn> } = { updateSW: vi.fn(async () => undefined) };

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: Options) => {
    captured.options = options;
    return captured.updateSW;
  },
}));

describe('registerServiceWorker', () => {
  beforeEach(() => {
    vi.resetModules();
    captured.options = undefined;
    captured.updateSW.mockClear();
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('registers in production, wires the update and offline callbacks, and applies updates with a reload', async () => {
    vi.stubEnv('PROD', true);
    const { registerServiceWorker } = await import('./register');
    const { usePwaStore } = await import('./pwa-store');
    registerServiceWorker();
    expect(captured.options?.immediate).toBe(true);

    captured.options?.onNeedRefresh?.();
    captured.options?.onOfflineReady?.();
    expect(usePwaStore.getState().needRefresh).toBe(true);
    expect(usePwaStore.getState().offlineReady).toBe(true);

    await usePwaStore.getState().applyUpdateFn?.();
    expect(captured.updateSW).toHaveBeenCalledWith(true);
  });

  it('does not register outside production (no worker exists in vite dev)', async () => {
    vi.stubEnv('PROD', false);
    const { registerServiceWorker } = await import('./register');
    registerServiceWorker();
    expect(captured.options).toBeUndefined();
  });
});
