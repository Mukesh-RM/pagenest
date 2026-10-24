import { useState } from 'react';
import { useInstall, useUpdatePrompt } from '@/sw';
import { InstallBanner } from '../components/InstallBanner';
import { IosInstallSheet } from '../components/IosInstallSheet';
import { UpdateAvailableSnackbar } from '../components/UpdateAvailableSnackbar';
import { memoryHintStore } from '../components/GestureHint';
import type { HintStore } from '../types';

export interface PwaPromptsProps {
  /** Audio or read-aloud is playing (from the audio controller). While true the update notice has no Refresh button. */
  isPlaying: boolean;
  /**
   * The app decides when an install offer is welcome, normally after the first book is added. Until then no banner
   * and no iPhone sheet appear. Default false.
   */
  installOfferReady?: boolean;
  /** Remembers "Not now" and "Got it" so each offer shows once. Pass settings or localStorage behind this. */
  store?: HintStore;
}

export const INSTALL_BANNER_ID = 'install-banner';
export const IOS_INSTALL_ID = 'ios-install-sheet';

/**
 * All three PWA prompts, wired to `@/sw`. Render it once, inside the theme provider, next to the app frame:
 *
 * - Update notice: "New version ready." with Refresh, or (while audio plays) "It will apply the next time you open
 *   PageNest." with no button, so a reload can never cut playback. Dismiss hides it until the next version.
 * - Install banner (Android, desktop Chrome and Edge): after `installOfferReady`, with Install and Not now.
 * - iPhone sheet (Safari, not installed): once, after `installOfferReady`, with the three steps.
 *
 * Nothing here renders when the app is installed.
 */
export function PwaPrompts({ isPlaying, installOfferReady = false, store: given }: PwaPromptsProps) {
  const [fallback] = useState(() => memoryHintStore());
  const store = given ?? fallback;
  const { ui, applyUpdate, dismiss } = useUpdatePrompt(isPlaying);
  const { canInstall, showIosSteps, installed, install } = useInstall();
  const [, bump] = useState(0);
  const remember = (id: string) => {
    store.markSeen(id);
    bump((n) => n + 1);
  };

  const bannerOpen = installOfferReady && canInstall && !installed && !store.hasSeen(INSTALL_BANNER_ID);
  const iosOpen = installOfferReady && showIosSteps && !installed && !store.hasSeen(IOS_INSTALL_ID);

  return (
    <>
      <UpdateAvailableSnackbar
        open={ui.kind !== 'none'}
        showRefresh={ui.kind === 'refresh'}
        message={ui.kind === 'next-launch' ? 'New version ready. It will apply the next time you open PageNest.' : 'New version ready.'}
        onRefresh={() => void applyUpdate()}
        onDismiss={dismiss}
      />
      <InstallBanner
        open={bannerOpen}
        onInstall={() => {
          remember(INSTALL_BANNER_ID);
          void install();
        }}
        onDismiss={() => remember(INSTALL_BANNER_ID)}
      />
      <IosInstallSheet open={iosOpen} onClose={() => remember(IOS_INSTALL_ID)} />
    </>
  );
}
