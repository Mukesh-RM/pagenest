import { Icon } from '../icons';
import { ThemedPortal } from '../theme/ThemeProvider';

export interface UpdateAvailableSnackbarProps {
  /** Show or hide. The app decides when (service worker found a new version). */
  open: boolean;
  /** Apply the update (the app reloads or refreshes). */
  onRefresh: () => void;
  /** Hide the prompt; the update applies on the next launch. */
  onDismiss: () => void;
  message?: string;
  /**
   * Show the Refresh button. Set false while audio plays (the notice then says the update applies on the
   * next launch), so a reload can never cut playback. Defaults to true.
   */
  showRefresh?: boolean;
  refreshLabel?: string;
  dismissLabel?: string;
}

/**
 * "New version ready, refresh" prompt (blueprint section 14). Props only: no service worker
 * code and no timer, so it never interrupts a playing book; it stays until dismissed.
 * Sits above the regular snackbar position and the bottom navigation.
 */
export function UpdateAvailableSnackbar({
  open,
  onRefresh,
  onDismiss,
  message = 'New version ready.',
  showRefresh = true,
  refreshLabel = 'Refresh',
  dismissLabel = 'Dismiss',
}: UpdateAvailableSnackbarProps) {
  return (
    <ThemedPortal>
      <div
        className="pn-snackbar-viewport pn-snackbar-viewport--stacked"
        data-pn-snackbar-viewport=""
        role="status"
        aria-live="polite"
      >
        {open ? (
          <div className="pn-snackbar pn-update-snackbar">
            <p className="pn-snackbar__message">{message}</p>
            {showRefresh ? (
              <button type="button" className="pn-snackbar__action" onClick={onRefresh}>
                {refreshLabel}
              </button>
            ) : null}
            <button type="button" className="pn-snackbar__action pn-snackbar__action--icon" aria-label={dismissLabel} onClick={onDismiss}>
              <Icon name="close" size={20} />
            </button>
          </div>
        ) : null}
      </div>
    </ThemedPortal>
  );
}
