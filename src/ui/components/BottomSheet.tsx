import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { ThemedPortal } from '../theme/ThemeProvider';
import { cx } from '../utils/cx';
import { getFocusable, trapTab } from '../utils/focus';
import { readDurationMs } from '../utils/motion';
import { isTopSheet, lockScroll, registerSheet, type SheetEntry } from '../utils/sheetHistory';
import { Button } from './Button';

export type SheetCloseReason = 'back' | 'escape' | 'scrim' | 'close-button' | 'swipe';

export interface BottomSheetProps {
  open: boolean;
  /** Called for every dismissal gesture; set `open` to false in response. */
  onClose: (reason: SheetCloseReason) => void;
  /** Heading and accessible name of the sheet. */
  title: string;
  /** Hide the heading visually (it is still the accessible name). */
  hideTitle?: boolean;
  children?: ReactNode;
  /** Sticky area under the body, for example primary buttons. */
  footer?: ReactNode;
  /** Element to focus on open. Defaults to the sheet itself, so screen readers read the title. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnScrim?: boolean;
  closeLabel?: string;
  className?: string;
}

const SWIPE_CLOSE_DISTANCE_PX = 96;
const SWIPE_CLOSE_VELOCITY_PX_PER_MS = 0.6;

/**
 * Modal bottom sheet (20 px top corners, slides up 250 ms ease-out).
 * Closes on: system back (popstate, before any route change), Esc, scrim click,
 * swipe down on the handle or header, and the close button.
 * Traps focus, restores it on close, locks page scroll, and is announced as an aria-modal dialog.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  hideTitle,
  children,
  footer,
  initialFocusRef,
  closeOnScrim = true,
  closeLabel = 'Close',
  className,
}: BottomSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const entryRef = useRef<SheetEntry | null>(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Mount, then slide in on the next frame; slide out, then unmount.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setShown(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setShown(false);
    setDragY(0);
    setDragging(false);
    const timer = window.setTimeout(() => setMounted(false), readDurationMs('--pn-duration-slow', 250));
    return () => window.clearTimeout(timer);
  }, [open]);

  // History entry (system back), Esc, scroll lock, focus trap and restore: only while open.
  useEffect(() => {
    if (!open || !mounted) return undefined;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlock = lockScroll();
    const { entry, release } = registerSheet(() => onCloseRef.current('back'));
    entryRef.current = entry;

    const sheet = sheetRef.current;
    const target = initialFocusRef?.current ?? sheet;
    target?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopSheet(entry)) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current('escape');
        return;
      }
      if (sheet) trapTab(event, sheet);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!isTopSheet(entry) || !sheet) return;
      const t = event.target;
      if (!(t instanceof Node) || sheet.contains(t)) return;
      // Snackbar actions (Undo) live above the sheet and stay reachable.
      if (t instanceof Element && t.closest('[data-pn-snackbar-viewport]')) return;
      (getFocusable(sheet)[0] ?? sheet).focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      entryRef.current = null;
      release();
      unlock();
      if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
    // initialFocusRef is read once on open on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted]);

  // Swipe down on the handle or header closes the sheet (blueprint 5.7).
  const drag = useRef<{ startY: number; startT: number; lastY: number; lastT: number } | null>(null);

  const onDragStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    drag.current = { startY: event.clientY, startT: event.timeStamp, lastY: event.clientY, lastT: event.timeStamp };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const onDragMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.lastY = event.clientY;
    d.lastT = event.timeStamp;
    setDragY(Math.max(0, event.clientY - d.startY));
  }, []);

  const onDragEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const distance = Math.max(0, event.clientY - d.startY);
    const elapsed = Math.max(1, event.timeStamp - d.startT);
    setDragging(false);
    if (distance > SWIPE_CLOSE_DISTANCE_PX || distance / elapsed > SWIPE_CLOSE_VELOCITY_PX_PER_MS) {
      onCloseRef.current('swipe');
    } else {
      setDragY(0);
    }
  }, []);

  if (!mounted) return null;

  const style = { '--pn-sheet-drag': `${dragY}px` } as CSSProperties;
  return (
    <ThemedPortal>
      <div className="pn-sheet-root" data-state={open && shown ? 'open' : 'closed'}>
        <div
          className="pn-scrim"
          data-testid="pn-scrim"
          aria-hidden="true"
          onClick={closeOnScrim ? () => onClose('scrim') : undefined}
        />
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-hidden={open ? undefined : true}
          tabIndex={-1}
          style={style}
          className={cx('pn-sheet', dragging && 'pn-sheet--dragging', className)}
        >
          <div
            className="pn-sheet__drag"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            data-testid="pn-sheet-drag"
          >
            <span className="pn-sheet__handle" aria-hidden="true" />
            <div className="pn-sheet__header">
              <h2 id={titleId} className={cx('pn-sheet__title', hideTitle && 'pn-visually-hidden')}>
                {title}
              </h2>
              <Button
                iconOnly
                icon="close"
                variant="ghost"
                aria-label={closeLabel}
                onClick={() => onClose('close-button')}
              />
            </div>
          </div>
          <div className="pn-sheet__body">{children}</div>
          {footer ? <div className="pn-sheet__footer">{footer}</div> : null}
        </div>
      </div>
    </ThemedPortal>
  );
}
