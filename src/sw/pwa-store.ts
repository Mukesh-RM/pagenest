import { create } from 'zustand';
import { isIosSafari, isStandalone, type BeforeInstallPromptEventLike } from './install';
import { requestPersistence, type PersistResult } from './persist';

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

interface PwaState {
  /** A new version is installed and waiting. */
  needRefresh: boolean;
  /** The user closed the update notice (resets when a newer version arrives). */
  updateDismissed: boolean;
  /** Everything needed to run offline is cached (fires once, after the first install). */
  offlineReady: boolean;
  /** Android: the browser offered an install prompt we are holding back. */
  installEvent: BeforeInstallPromptEventLike | undefined;
  /** The app is running installed (standalone) or was just installed. */
  installed: boolean;
  /** iPhone and iPad Safari: show the one-time Add to Home Screen steps. */
  iosInstallHint: boolean;
  persist: PersistResult | undefined;
  applyUpdateFn: (() => Promise<void>) | undefined;

  setNeedRefresh: () => void;
  setOfflineReady: () => void;
  dismissUpdate: () => void;
  setApplyUpdate: (fn: () => Promise<void>) => void;
  setInstallEvent: (event: BeforeInstallPromptEventLike | undefined) => void;
  setInstalled: () => void;
  setEnvironment: (env: { installed: boolean; iosInstallHint: boolean }) => void;
  promptInstall: () => Promise<InstallOutcome>;
  askPersistence: () => Promise<PersistResult>;
}

export const usePwaStore = create<PwaState>((set, get) => ({
  needRefresh: false,
  updateDismissed: false,
  offlineReady: false,
  installEvent: undefined,
  installed: false,
  iosInstallHint: false,
  persist: undefined,
  applyUpdateFn: undefined,

  setNeedRefresh: () => set({ needRefresh: true, updateDismissed: false }),
  setOfflineReady: () => set({ offlineReady: true }),
  dismissUpdate: () => set({ updateDismissed: true }),
  setApplyUpdate: (applyUpdateFn) => set({ applyUpdateFn }),
  setInstallEvent: (installEvent) => set({ installEvent }),
  setInstalled: () => set({ installed: true, installEvent: undefined, iosInstallHint: false }),
  setEnvironment: ({ installed, iosInstallHint }) => set({ installed, iosInstallHint: iosInstallHint && !installed }),

  async promptInstall() {
    const event = get().installEvent;
    if (!event) return 'unavailable';
    set({ installEvent: undefined }); // a prompt event can be used once
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === 'accepted') get().setInstalled();
      return outcome;
    } catch {
      return 'unavailable';
    }
  },

  async askPersistence() {
    const persist = await requestPersistence();
    set({ persist });
    return persist;
  },
}));

/** Read the install state of this window and listen for the browser's install events. Returns an unsubscribe. */
export function watchInstall(win: Window = window): () => void {
  const store = usePwaStore.getState();
  store.setEnvironment({
    installed: isStandalone(win),
    iosInstallHint: isIosSafari(win.navigator.userAgent, win.navigator.maxTouchPoints),
  });
  const onPrompt = (event: Event) => {
    event.preventDefault();
    usePwaStore.getState().setInstallEvent(event as BeforeInstallPromptEventLike);
  };
  const onInstalled = () => usePwaStore.getState().setInstalled();
  win.addEventListener('beforeinstallprompt', onPrompt);
  win.addEventListener('appinstalled', onInstalled);
  return () => {
    win.removeEventListener('beforeinstallprompt', onPrompt);
    win.removeEventListener('appinstalled', onInstalled);
  };
}
