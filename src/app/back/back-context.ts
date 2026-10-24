import { createContext, useContext, useEffect, useRef } from 'react';
import type { BackStack } from './back-stack';

export const BackStackContext = createContext<BackStack | undefined>(undefined);

/** The app's back stack. Throws outside {@link BackStackProvider}. */
export function useBackStack(): BackStack {
  const stack = useContext(BackStackContext);
  if (!stack) throw new Error('useBackStack must be used inside <BackStackProvider>.');
  return stack;
}

/**
 * Make the back gesture close a sheet.
 *
 * Call it in the component that owns the sheet's open state:
 *
 * ```tsx
 * const [open, setOpen] = useState(false);
 * useBackClose(open, () => setOpen(false));
 * ```
 *
 * While `open` is true, one history entry is held for the sheet. The back
 * gesture then calls `onClose` instead of leaving the screen. When your own
 * code sets `open` to false (Close button, Escape, backdrop tap) the entry is
 * removed again, so nothing piles up in history. Sheets can be nested: each
 * back gesture closes the topmost one. `onClose` may change between renders;
 * the latest one is always used.
 */
export function useBackClose(open: boolean, onClose: () => void): void {
  const stack = useBackStack();
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const token = stack.push(() => latest.current());
    return () => stack.release(token);
  }, [open, stack]);
}
