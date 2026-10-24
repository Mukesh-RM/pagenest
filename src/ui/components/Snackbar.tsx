import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ThemedPortal } from '../theme/ThemeProvider';

/** Deletions and shelf changes show Undo for 8 seconds (blueprint 5.8). */
export const SNACKBAR_DURATION_MS = 8000;

export type SnackbarDismissReason = 'timeout' | 'action' | 'close' | 'replaced';

export interface SnackbarOptions {
  message: string;
  /** Label of the action button. Defaults to "Undo" when `onAction` is given. */
  actionLabel?: string;
  /** Called when the action (Undo) is pressed. */
  onAction?: () => void;
  /**
   * Called exactly once when the snackbar goes away for any reason. Use it to commit a
   * deletion when the reason is "timeout" or "replaced".
   */
  onDismiss?: (reason: SnackbarDismissReason) => void;
  /** Milliseconds before auto-dismiss. Defaults to 8000. */
  durationMs?: number;
}

export interface SnackbarApi {
  /** Show a snackbar. A new one replaces the current one. Returns its id. */
  show: (options: SnackbarOptions) => number;
  dismiss: (id?: number) => void;
}

const SnackbarContext = createContext<SnackbarApi | null>(null);

export function useSnackbar(): SnackbarApi {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used inside <SnackbarProvider>.');
  return ctx;
}

export interface SnackbarViewProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Hover or focus pauses the auto-dismiss timer (WCAG 2.2.1). */
  onPause?: () => void;
  onResume?: () => void;
}

/** Presentational snackbar (no timer). Use {@link SnackbarProvider} in the app. */
export function SnackbarView({ message, actionLabel = 'Undo', onAction, onPause, onResume }: SnackbarViewProps) {
  return (
    <div className="pn-snackbar" onMouseEnter={onPause} onMouseLeave={onResume} onFocus={onPause} onBlur={onResume}>
      <p className="pn-snackbar__message">{message}</p>
      {onAction ? (
        <button type="button" className="pn-snackbar__action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

interface Active extends SnackbarOptions {
  id: number;
}

/**
 * Provides `useSnackbar()` and renders one snackbar at a time above the bottom navigation.
 * The live region exists from the start so screen readers announce each new message politely.
 */
export function SnackbarProvider({ children }: { children?: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const activeRef = useRef<Active | null>(null);
  const nextId = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadline = useRef(0);
  const remaining = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const finish = useCallback(
    (reason: SnackbarDismissReason) => {
      const current = activeRef.current;
      if (!current) return;
      activeRef.current = null;
      clearTimer();
      setActive(null);
      current.onDismiss?.(reason);
    },
    [clearTimer],
  );

  const startTimer = useCallback(
    (ms: number) => {
      clearTimer();
      remaining.current = ms;
      deadline.current = Date.now() + ms;
      timer.current = setTimeout(() => finish('timeout'), ms);
    },
    [clearTimer, finish],
  );

  const show = useCallback(
    (options: SnackbarOptions) => {
      finish('replaced');
      const next: Active = { ...options, id: nextId.current++ };
      activeRef.current = next;
      setActive(next);
      startTimer(options.durationMs ?? SNACKBAR_DURATION_MS);
      return next.id;
    },
    [finish, startTimer],
  );

  const dismiss = useCallback(
    (id?: number) => {
      if (id !== undefined && activeRef.current?.id !== id) return;
      finish('close');
    },
    [finish],
  );

  const pause = useCallback(() => {
    if (!timer.current) return;
    remaining.current = Math.max(0, deadline.current - Date.now());
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    if (!activeRef.current || timer.current) return;
    startTimer(Math.max(1000, remaining.current));
  }, [startTimer]);

  useEffect(
    () => () => {
      clearTimer();
    },
    [clearTimer],
  );

  const api = useMemo<SnackbarApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <SnackbarContext.Provider value={api}>
      {children}
      <ThemedPortal>
        <div className="pn-snackbar-viewport" data-pn-snackbar-viewport="" role="status" aria-live="polite">
          {active ? (
            <SnackbarView
              key={active.id}
              message={active.message}
              actionLabel={active.actionLabel ?? 'Undo'}
              onAction={
                active.onAction
                  ? () => {
                      active.onAction?.();
                      finish('action');
                    }
                  : undefined
              }
              onPause={pause}
              onResume={resume}
            />
          ) : null}
        </div>
      </ThemedPortal>
    </SnackbarContext.Provider>
  );
}
