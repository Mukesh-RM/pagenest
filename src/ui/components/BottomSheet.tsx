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
  /** Extra inline style, for example the `--pn-cover-tint` variables from `useCoverTint` (with className "pn-tinted"). */
  style?: CSSProperties;
}

const SWIPE_CLOSE_DISTANCE_PX = 96;
const SWIPE_CLOSE_VELOCITY_PX_PER_MS = 0.6;

/**
 * Modal bottom sheet (20 px top corners, slides up 250 ms ease-out).
 * Closes on: system back (popstate, before any route change), Esc, scrim click,
 * swipe down on the handle or header, and the close button.
 * Back contract: opening pushes one history entry with a unique key; closing any other way pops it only if it
 * is still the current entry (see utils/sheetHistory). Dragging is written from refs in requestAnimationFrame
 * (transform only), so a drag never re-renders the sheet.
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
  style: extraStyle,
}: BottomSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  // The sheet is in the DOM while open, and for one slide-out after it closes. Deriving `mounted` (instead of
  // flipping state in an effect) means opening costs ONE render, and `data-state` and the moving class are
  // written straight to the DOM, so no further re-render happens before the first paint.
  const [leaving, setLeaving] = useState(false);
  const mounted = open || leaving;
  const rootRef = useRef<HTMLDivElement>(null);
  // Drag position lives in refs and is written to the DOM from requestAnimationFrame; React state only
  // changes when a drag starts or ends (never per pointermove).
  const [dragging, setDragging] = useState(false);
  const [springing, setSpringing] = useState(false);
  const dragYRef = useRef(0);
  const frameRef = useRef(0);
  const springTimerRef = useRef(0);
  // Motion duration read once per open or close (one getComputedStyle), then reused.
  const slowMsRef = useRef(250);
  const entryRef = useRef<SheetEntry | null>(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const writeDrag = useCallback((y: number) => {
    dragYRef.current = y;
    sheetRef.current?.style.setProperty('--pn-sheet-drag', `${y}px`);
  }, []);

  // Slide in on the next frame; slide out, then unmount. All writes are attributes and classes on refs.
  const wasOpen = useRef(false);
  useEffect(() => {
    const root = rootRef.current;
    const sheet = sheetRef.current;
    // will-change: transform only while the sheet is actually moving.
    const markMoving = (on: boolean) => sheet?.classList.toggle('pn-sheet--moving', on);
    if (open) {
      wasOpen.current = true;
      writeDrag(0);
      markMoving(true);
      const frame = window.requestAnimationFrame(() => {
        // One style read per open: it also resolves the closed state, so the slide-in transition starts from it.
        slowMsRef.current = readDurationMs('--pn-duration-slow', 250);
        root?.setAttribute('data-state', 'open');
      });
      const settled = window.setTimeout(() => markMoving(false), slowMsRef.current + 60);
      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(settled);
      };
    }
    if (!wasOpen.current) return undefined;
    wasOpen.current = false;
    root?.setAttribute('data-state', 'closed');
    markMoving(true);
    setDragging(false);
    setLeaving(true);
    const timer = window.setTimeout(() => setLeaving(false), slowMsRef.current);
    return () => window.clearTimeout(timer);
  }, [open, writeDrag]);

  useEffect(
    () => () => {
      window.cancelAnimationFrame(frameRef.current);
      window.clearTimeout(springTimerRef.current);
    },
    [],
  );

  // History entry (system back), Esc, scroll lock, focus trap and restore: only while open.
  useEffect(() => {
    if (!open) return undefined;
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
  }, [open]);

  // Swipe down on the handle or header closes the sheet (blueprint 5.7).
  const drag = useRef<{ startY: number; startT: number } | null>(null);
  const pendingY = useRef(0);

  const onDragStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    window.clearTimeout(springTimerRef.current);
    drag.current = { startY: event.clientY, startT: event.timeStamp };
    pendingY.current = 0;
    setSpringing(false);
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const onDragMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      pendingY.current = Math.max(0, event.clientY - d.startY);
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = 0;
        writeDrag(pendingY.current);
      });
    },
    [writeDrag],
  );

  const onDragEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      const distance = Math.max(0, event.clientY - d.startY);
      const elapsed = Math.max(1, event.timeStamp - d.startT);
      writeDrag(distance);
      setDragging(false);
      if (distance > SWIPE_CLOSE_DISTANCE_PX || distance / elapsed > SWIPE_CLOSE_VELOCITY_PX_PER_MS) {
        onCloseRef.current('swipe');
      } else {
        // Released short of the close threshold: spring back with a small overshoot (transform only).
        setSpringing(true);
        writeDrag(0);
        springTimerRef.current = window.setTimeout(() => setSpringing(false), slowMsRef.current + 50);
      }
    },
    [writeDrag],
  );

  if (!mounted) return null;

  return (
    <ThemedPortal>
      <div ref={rootRef} className="pn-sheet-root" data-state="closed">
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
          style={extraStyle}
          className={cx(
            'pn-sheet',
            springing && 'pn-sheet--moving',
            dragging && 'pn-sheet--moving pn-sheet--dragging',
            springing && 'pn-sheet--springing',
            className,
          )}
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
