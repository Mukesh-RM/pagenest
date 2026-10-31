import { useState } from 'react';
import { Icon, type IconName } from '../icons';
import { cx } from '../utils/cx';
import type { HintStore } from '../types';

export interface GestureHintProps {
  /** Stable id: once seen, the hint never shows again. */
  id: string;
  /** One short line: "Swipe up on the player for chapters." */
  message: string;
  icon?: IconName;
  /** Persistence, passed in by the app (localStorage, IndexedDB, settings). */
  store: HintStore;
  /** Parent decides when it is a good moment (for example after the first book opens). Default true. */
  enabled?: boolean;
  onDismiss?: (id: string) => void;
  className?: string;
}

/**
 * One-time gentle gesture hint. Inline and quiet: not a popup, not a tooltip, never covers content, never
 * traps focus. Dismiss with the button, and it is remembered through the passed-in store.
 */
export function GestureHint({ id, message, icon = 'info', store, enabled = true, onDismiss, className }: GestureHintProps) {
  const [dismissed, setDismissed] = useState(false);
  if (!enabled || dismissed || store.hasSeen(id)) return null;
  const dismiss = () => {
    store.markSeen(id);
    setDismissed(true);
    onDismiss?.(id);
  };
  return (
    <div role="note" className={cx('pn-hint', className)} data-hint={id}>
      <span className="pn-hint__icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <p className="pn-hint__text">{message}</p>
      <button type="button" className="pn-hint__dismiss" onClick={dismiss} aria-label={`Got it: ${message}`}>
        Got it
      </button>
    </div>
  );
}

/** In-memory {@link HintStore} for tests and the demo. */
export function memoryHintStore(seen: Iterable<string> = []): HintStore {
  const ids = new Set(seen);
  return { hasSeen: (id) => ids.has(id), markSeen: (id) => void ids.add(id) };
}
