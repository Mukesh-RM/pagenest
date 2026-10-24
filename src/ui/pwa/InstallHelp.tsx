import { useCallback, useRef, useState } from 'react';
import { useInstall, useOfflineReady, usePersistence } from '@/sw';
import { Button } from '../components/Button';
import { InstallHelpSheet } from '../components/InstallHelpSheet';
import { formatBytes } from './format';

export interface InstallHelpProps {
  /** Label of the button in Settings. The e2e contract needs a name that matches /install help/i. */
  label?: string;
  className?: string;
}

/**
 * The connected "Install help" row for Settings: a button named "Install help" that opens the install sheet
 * (role="dialog", aria-modal="true", Close button, focus trap, Esc and the back gesture close it, and focus
 * returns to the button). The sheet reads the PWA state from `@/sw`: Android and desktop get the browser's own
 * install button, iPhone and iPad get the three steps first, an installed app is told so, and there is an optional
 * "keep my books safe" row from `usePersistence()`.
 */
export function InstallHelp({ label = 'Install help', className }: InstallHelpProps) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const { canInstall, showIosSteps, installed, install } = useInstall();
  const offlineReady = useOfflineReady();
  const { result, request } = usePersistence();

  const onInstall = useCallback(() => {
    void install();
  }, [install]);
  const onRequest = useCallback(() => {
    void request();
  }, [request]);

  const usageText =
    result && result.supported && result.usageBytes !== undefined
      ? result.quotaBytes
        ? `${formatBytes(result.usageBytes)} of about ${formatBytes(result.quotaBytes)}`
        : formatBytes(result.usageBytes)
      : undefined;

  return (
    <>
      <Button ref={opener} variant="secondary" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {label}
      </Button>
      <InstallHelpSheet
        open={open}
        onClose={() => setOpen(false)}
        installed={installed}
        canInstall={canInstall}
        showIosSteps={showIosSteps}
        onInstall={onInstall}
        offlineReady={offlineReady}
        persistence={{
          supported: result?.supported ?? true,
          persisted: result?.persisted ?? false,
          usageText,
          onRequest,
        }}
      />
    </>
  );
}
