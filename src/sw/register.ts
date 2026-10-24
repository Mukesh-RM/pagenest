/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register';
import { usePwaStore, watchInstall } from './pwa-store';
import { shouldCheckForUpdate } from './update-flow';

/**
 * Register the service worker (production builds only; the worker does not exist in `vite dev`) and start
 * listening for install events. Call once from main.tsx. Returns nothing the app has to keep: all state lives in
 * `usePwaStore`, read through the hooks in `./hooks`.
 */
export function registerServiceWorker(): void {
  watchInstall();
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const store = usePwaStore.getState();
  let lastCheck = Date.now();
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => usePwaStore.getState().setNeedRefresh(),
    onOfflineReady: () => usePwaStore.getState().setOfflineReady(),
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && shouldCheckForUpdate(Date.now(), lastCheck)) {
          lastCheck = Date.now();
          void registration.update().catch(() => undefined);
        }
      });
    },
  });
  // Posts SKIP_WAITING to the waiting worker and reloads once it controls the page.
  store.setApplyUpdate(() => updateSW(true));
}
