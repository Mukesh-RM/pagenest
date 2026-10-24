import { Icon } from '../icons';
import { cx } from '../utils/cx';
import { Button } from './Button';

/** Plain-word messages for the failures PageNest can hit. Never codes, never stack traces (blueprint 5.8). */
export const PLAIN_ERRORS = {
  drm: { title: 'This file is protected', description: 'This file is protected by DRM, so PageNest cannot open it.' },
  damaged: { title: 'This file looks damaged', description: 'This file looks damaged. Try another copy.' },
  unsupported: { title: 'PageNest cannot open this kind of file', description: 'It opens EPUB, PDF and audiobook files such as MP3 and M4B.' },
  storage: { title: 'Your device is almost full', description: 'There is not enough space to add this book. Free up some space and try again.' },
  offline: { title: 'You are offline', description: 'Your books still work. This needs a connection.' },
  voice: { title: 'This voice could not start', description: 'Try another voice, or check that it finished downloading.' },
  generic: { title: 'Something went wrong', description: 'Nothing was lost. Please try again.' },
} as const;

export type PlainErrorKind = keyof typeof PLAIN_ERRORS;

export interface ErrorNoticeProps {
  kind?: PlainErrorKind;
  /** Override the headline. */
  title?: string;
  /** Override the sentence. Keep it short, warm and free of codes. */
  description?: string;
  /** "Try again", "Choose another file"... one clear next step. */
  actionLabel?: string;
  onAction?: () => void;
  /** Adds a quiet Dismiss button. */
  onDismiss?: () => void;
  className?: string;
}

/** Inline error in plain words with at most one next step. Announced to screen readers (role="alert"). */
export function ErrorNotice({ kind = 'generic', title, description, actionLabel, onAction, onDismiss, className }: ErrorNoticeProps) {
  const text = PLAIN_ERRORS[kind];
  return (
    <div role="alert" className={cx('pn-error', className)}>
      <span className="pn-error__icon" aria-hidden="true">
        <Icon name="alert" size={24} />
      </span>
      <div className="pn-error__text">
        <p className="pn-error__title">{title ?? text.title}</p>
        <p className="pn-error__description">{description ?? text.description}</p>
        {(actionLabel && onAction) || onDismiss ? (
          <div className="pn-error__actions">
            {actionLabel && onAction ? (
              <Button variant="secondary" onClick={onAction}>
                {actionLabel}
              </Button>
            ) : null}
            {onDismiss ? (
              <Button variant="ghost" onClick={onDismiss}>
                Dismiss
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
