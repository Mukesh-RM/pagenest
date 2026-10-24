import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInstall, useOfflineReady, usePersistence, useUpdatePrompt } from './hooks';
import { usePwaStore, watchInstall } from './pwa-store';
import type { BeforeInstallPromptEventLike } from './install';

const initial = usePwaStore.getState();
beforeEach(() => usePwaStore.setState(initial, true));

function installEvent(outcome: 'accepted' | 'dismissed'): BeforeInstallPromptEventLike {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEventLike;
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe('useUpdatePrompt', () => {
  it('shows nothing, then Refresh, then the next-launch note while playing', () => {
    const { result, rerender } = renderHook(({ playing }) => useUpdatePrompt(playing), { initialProps: { playing: false } });
    expect(result.current.ui.kind).toBe('none');
    act(() => usePwaStore.getState().setNeedRefresh());
    expect(result.current.ui.kind).toBe('refresh');
    rerender({ playing: true });
    expect(result.current.ui.kind).toBe('next-launch');
  });

  it('applies the update only when Refresh is allowed', async () => {
    const apply = vi.fn(async () => undefined);
    usePwaStore.getState().setApplyUpdate(apply);
    usePwaStore.getState().setNeedRefresh();
    const { result, rerender } = renderHook(({ playing }) => useUpdatePrompt(playing), { initialProps: { playing: true } });
    await act(() => result.current.applyUpdate());
    expect(apply).not.toHaveBeenCalled(); // playing: never interrupt
    rerender({ playing: false });
    await act(() => result.current.applyUpdate());
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('dismiss hides the notice until a newer version arrives', () => {
    const { result } = renderHook(() => useUpdatePrompt(false));
    act(() => usePwaStore.getState().setNeedRefresh());
    act(() => result.current.dismiss());
    expect(result.current.ui.kind).toBe('none');
    act(() => usePwaStore.getState().setNeedRefresh());
    expect(result.current.ui.kind).toBe('refresh');
  });
});

describe('useOfflineReady', () => {
  it('turns true once the worker reports the app is cached', () => {
    const { result } = renderHook(() => useOfflineReady());
    expect(result.current).toBe(false);
    act(() => usePwaStore.getState().setOfflineReady());
    expect(result.current).toBe(true);
  });
});

describe('install flow', () => {
  it('holds the Android install event and uses it once', async () => {
    const unwatch = watchInstall(window);
    const event = installEvent('accepted');
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    const { result } = renderHook(() => useInstall());
    expect(result.current.canInstall).toBe(true);
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.install();
    });
    expect(outcome).toBe('accepted');
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.installed).toBe(true);
    expect(result.current.canInstall).toBe(false);
    await act(async () => {
      expect(await result.current.install()).toBe('unavailable');
    });
    unwatch();
  });

  it('a dismissed prompt is not offered again in this visit', async () => {
    usePwaStore.getState().setInstallEvent(installEvent('dismissed'));
    const { result } = renderHook(() => useInstall());
    await act(async () => {
      expect(await result.current.install()).toBe('dismissed');
    });
    expect(result.current.canInstall).toBe(false);
    expect(result.current.installed).toBe(false);
  });

  it('appinstalled hides every install prompt', () => {
    const unwatch = watchInstall(window);
    usePwaStore.setState({ iosInstallHint: true });
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    const { result } = renderHook(() => useInstall());
    expect(result.current.installed).toBe(true);
    expect(result.current.showIosSteps).toBe(false);
    unwatch();
  });

  it('shows the iPhone steps only in iOS Safari that is not installed', () => {
    const fake = (ua: string, standalone: boolean) =>
      ({
        navigator: { userAgent: ua, maxTouchPoints: 5, standalone },
        matchMedia: () => ({ matches: false }),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as Window;
    const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1';
    watchInstall(fake(safari, false));
    expect(usePwaStore.getState().iosInstallHint).toBe(true);
    watchInstall(fake(safari, true));
    expect(usePwaStore.getState().iosInstallHint).toBe(false);
    expect(usePwaStore.getState().installed).toBe(true);
  });
});

describe('usePersistence', () => {
  it('stores the answer of the browser', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persisted: async () => false, persist: async () => true, estimate: async () => ({ usage: 5, quota: 50 }) },
    });
    const { result } = renderHook(() => usePersistence());
    expect(result.current.result).toBeUndefined();
    await act(async () => {
      await result.current.request();
    });
    expect(result.current.result).toEqual({ supported: true, persisted: true, usageBytes: 5, quotaBytes: 50 });
  });
});
