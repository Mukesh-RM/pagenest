import { useId } from 'react';
import { Icon } from '../icons';
import { cx } from '../utils/cx';
import { Button } from './Button';

export interface InstallBannerProps {
  /** Hide the banner without unmounting the parent. Defaults to true. */
  open?: boolean;
  /** The user tapped Install: the app calls the saved beforeinstallprompt. */
  onInstall: () => void;
  /** The user tapped Not now. */
  onDismiss: () => void;
  title?: string;
  description?: string;
  installLabel?: string;
  dismissLabel?: string;
  className?: string;
}

/**
 * Quiet Android install banner (blueprint 5.6): offered after the first book is added.
 * Props only: the Shell wires the install prompt and remembers the dismissal.
 */
export function InstallBanner({
  open = true,
  onInstall,
  onDismiss,
  title = 'Install InkQuiet',
  description = 'Add it to your home screen to open it like an app and keep playing with the screen off.',
  installLabel = 'Install',
  dismissLabel = 'Not now',
  className,
}: InstallBannerProps) {
  const titleId = useId();
  if (!open) return null;
  return (
    <section aria-labelledby={titleId} className={cx('pn-install-banner', className)}>
      <span className="pn-install-banner__icon" aria-hidden="true">
        <Icon name="download" />
      </span>
      <div className="pn-install-banner__text">
        <h2 id={titleId} className="pn-install-banner__title">
          {title}
        </h2>
        <p className="pn-install-banner__description">{description}</p>
      </div>
      <div className="pn-install-banner__actions">
        <Button variant="ghost" onClick={onDismiss}>
          {dismissLabel}
        </Button>
        <Button onClick={onInstall}>{installLabel}</Button>
      </div>
    </section>
  );
}
