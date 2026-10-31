import { useRef } from 'react';
import { BottomSheet, type SheetCloseReason } from './BottomSheet';
import { Button } from './Button';
import { IosInstallSteps } from './IosInstallSteps';

export interface InstallHelpPersistence {
  /** The browser promised to keep the data. */
  persisted: boolean;
  /** False when the browser has no persistent storage. */
  supported: boolean;
  /** "12 MB of about 4 GB", already formatted by the app; omit when unknown. */
  usageText?: string;
  /** Ask the browser to keep the data. */
  onRequest: () => void;
}

export interface InstallHelpSheetProps {
  open: boolean;
  /** Called for every dismissal (back, Esc, scrim, swipe, Close, Done). */
  onClose: (reason: SheetCloseReason | 'done') => void;
  /** Running as an installed app: say so and hide the how-to. */
  installed?: boolean;
  /** Android or desktop Chrome and Edge: the browser can show its own install dialog now. */
  canInstall?: boolean;
  /** iPhone or iPad Safari, not installed: the three steps come first. */
  showIosSteps?: boolean;
  /** The user tapped Install; the app calls the saved install prompt. */
  onInstall?: () => void;
  /** Everything is cached for offline use. */
  offlineReady?: boolean;
  /** Optional "keep my books safe" row; omit to hide it. */
  persistence?: InstallHelpPersistence;
  title?: string;
}

/**
 * "Install help" (Settings, blueprint 5.6). A modal bottom sheet: role="dialog", aria-modal, a Close button,
 * a focus trap, Esc and the back gesture close it, and focus returns to the button that opened it.
 * Props only: the Shell wires the install state (see `InstallHelp` for the connected version).
 */
export function InstallHelpSheet({
  open,
  onClose,
  installed = false,
  canInstall = false,
  showIosSteps = false,
  onInstall,
  offlineReady = false,
  persistence,
  title = 'Install help',
}: InstallHelpSheetProps) {
  const initialFocus = useRef<HTMLElement>(null);
  const iosFirst = showIosSteps && !installed;
  const ios = (
    <section key="ios" className="pn-install-help__section" aria-labelledby="pn-install-help-ios">
      <h3 id="pn-install-help-ios" className="pn-install-help__heading">
        On iPhone or iPad
      </h3>
      <p className="pn-install-help__text">Open InkQuiet in Safari, then:</p>
      <IosInstallSteps />
    </section>
  );
  const android = (
    <section key="android" className="pn-install-help__section" aria-labelledby="pn-install-help-android">
      <h3 id="pn-install-help-android" className="pn-install-help__heading">
        On Android or a computer
      </h3>
      {canInstall ? (
        <>
          <p className="pn-install-help__text">Your browser can install InkQuiet now. It opens like an app and keeps playing with the screen off.</p>
          <Button onClick={onInstall} icon="download">
            Install InkQuiet
          </Button>
        </>
      ) : (
        <p className="pn-install-help__text">
          Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. If you do not see it,
          InkQuiet may already be installed, or your browser does not offer installing.
        </p>
      )}
    </section>
  );

  return (
    <BottomSheet
      open={open}
      title={title}
      onClose={onClose}
      initialFocusRef={initialFocus}
      className="pn-install-help"
      footer={
        <Button block variant="secondary" onClick={() => onClose('done')}>
          Done
        </Button>
      }
    >
      <p
        ref={(node) => {
          (initialFocus as { current: HTMLElement | null }).current = node;
        }}
        tabIndex={-1}
        className="pn-install-help__status"
      >
        {installed
          ? 'InkQuiet is installed on this device. Open it from your home screen.'
          : 'Installing is optional and free. It makes InkQuiet open full screen'}
        {installed ? null : offlineReady ? '.' : ' and work offline.'}
        {offlineReady ? ' Ready to use offline.' : ''}
      </p>
      {installed ? null : iosFirst ? [ios, android] : [android, ios]}
      {persistence ? (
        <section className="pn-install-help__section" aria-labelledby="pn-install-help-keep">
          <h3 id="pn-install-help-keep" className="pn-install-help__heading">
            Keep your books safe
          </h3>
          {!persistence.supported ? (
            <p className="pn-install-help__text">Your browser cannot promise to keep your books. Back them up from Settings now and then.</p>
          ) : persistence.persisted ? (
            <p className="pn-install-help__text">Your browser will keep your books and progress.</p>
          ) : (
            <>
              <p className="pn-install-help__text">Your browser may clear your books if space runs low. Asking it to keep them helps.</p>
              <Button variant="secondary" onClick={persistence.onRequest}>
                Ask my browser to keep them
              </Button>
            </>
          )}
          {persistence.usageText ? <p className="pn-install-help__meta">{persistence.usageText}</p> : null}
        </section>
      ) : null}
    </BottomSheet>
  );
}
