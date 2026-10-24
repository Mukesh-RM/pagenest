import { useCallback } from 'react';
import { usePwaStore, type InstallOutcome } from './pwa-store';
import { updateUi, type UpdateUi } from './update-flow';
import type { PersistResult } from './persist';

export interface UpdatePrompt {
  /** What to render: nothing, "New version ready, refresh" with a button, or "applies next launch" without one. */
  ui: UpdateUi;
  /** Call only from the user's tap on Refresh. A no-op while `ui.kind` is not `refresh`. */
  applyUpdate: () => Promise<void>;
  /** Hide the notice until the next new version. */
  dismiss: () => void;
}

/** `isPlaying`: pass whether audio or read-aloud is playing (from the audio controller). */
export function useUpdatePrompt(isPlaying: boolean): UpdatePrompt {
  const needRefresh = usePwaStore((s) => s.needRefresh);
  const dismissed = usePwaStore((s) => s.updateDismissed);
  const apply = usePwaStore((s) => s.applyUpdateFn);
  const dismiss = usePwaStore((s) => s.dismissUpdate);
  const ui = updateUi({ needRefresh, isPlaying, dismissed });
  const applyUpdate = useCallback(async () => {
    if (ui.kind !== 'refresh') return;
    await apply?.();
  }, [ui.kind, apply]);
  return { ui, applyUpdate, dismiss };
}

export interface InstallState {
  /** Android and desktop Chrome/Edge: the browser can show its install dialog now. */
  canInstall: boolean;
  /** iPhone and iPad Safari, not yet installed: show the three steps (Share, Add to Home Screen, Add). */
  showIosSteps: boolean;
  /** Running as an installed app (or just installed): hide every install prompt. */
  installed: boolean;
  /** Show the browser's install dialog. Call from a tap. */
  install: () => Promise<InstallOutcome>;
}

export function useInstall(): InstallState {
  const canInstall = usePwaStore((s) => s.installEvent !== undefined);
  const showIosSteps = usePwaStore((s) => s.iosInstallHint);
  const installed = usePwaStore((s) => s.installed);
  const install = usePwaStore((s) => s.promptInstall);
  return { canInstall: canInstall && !installed, showIosSteps, installed, install };
}

export interface PersistenceState {
  /** `undefined` until `request()` has run once. */
  result: PersistResult | undefined;
  /** Ask the browser to keep the data and report the answer. */
  request: () => Promise<PersistResult>;
}

export function usePersistence(): PersistenceState {
  const result = usePwaStore((s) => s.persist);
  const request = usePwaStore((s) => s.askPersistence);
  return { result, request };
}

/** True once everything needed to run offline is cached. */
export function useOfflineReady(): boolean {
  return usePwaStore((s) => s.offlineReady);
}
