import { useCallback, useEffect, useRef, type HTMLAttributes, type ReactNode, type PointerEvent, type MouseEvent } from 'react';
import { cx } from '../utils/cx';

export const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

interface CardBaseProps {
  /** Remove the inner padding (for cover cards). */
  flush?: boolean;
  className?: string;
  children?: ReactNode;
}

export interface StaticCardProps extends CardBaseProps, Omit<HTMLAttributes<HTMLElement>, 'children' | 'onClick'> {
  as?: 'div' | 'article' | 'section' | 'li';
  onPress?: undefined;
  onLongPress?: undefined;
}

export interface InteractiveCardProps
  extends CardBaseProps,
    Omit<HTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'> {
  /** Makes the card a button. Provide an accessible name through content or aria-label. */
  onPress: () => void;
  /**
   * Long-press (500 ms), also triggered by right-click or the context-menu key.
   * The library uses it to start multi-select.
   */
  onLongPress?: () => void;
  /** Multi-select state; exposed as aria-pressed. */
  selected?: boolean;
  as?: never;
}

export type CardProps = StaticCardProps | InteractiveCardProps;

/**
 * Card with 12 px corners, raised by tone (not shadow). Static by default; pass `onPress` to get
 * a 44 px+ button card. Inside an interactive card use inline elements (span) for content.
 */
export function Card(props: CardProps) {
  if (props.onPress) return <InteractiveCard {...props} />;
  const { as: Tag = 'div', flush, className, children, ...rest } = props as StaticCardProps;
  delete rest.onPress; // never forward the interactive props to a plain element
  delete rest.onLongPress;
  return (
    <Tag className={cx('pn-card', flush && 'pn-card--flush', className)} {...rest}>
      {children}
    </Tag>
  );
}

function InteractiveCard({
  onPress,
  onLongPress,
  selected,
  flush,
  className,
  children,
  as: _as,
  ...rest
}: InteractiveCardProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    longPressed.current = false;
    if (!onLongPress || (e.pointerType === 'mouse' && e.button !== 0)) return;
    origin.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      timer.current = null;
      longPressed.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const start = origin.current;
    if (!start || !timer.current) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > LONG_PRESS_MOVE_TOLERANCE_PX) cancel();
  };

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (longPressed.current) {
      // The long press already handled this gesture; swallow the click that follows release.
      longPressed.current = false;
      e.preventDefault();
      return;
    }
    onPress();
  };

  const onContextMenu = (e: MouseEvent<HTMLButtonElement>) => {
    if (!onLongPress) return;
    e.preventDefault();
    cancel();
    longPressed.current = false;
    onLongPress();
  };

  return (
    <button
      type="button"
      aria-pressed={selected === undefined ? undefined : selected}
      {...rest}
      className={cx('pn-card', 'pn-card--interactive', flush && 'pn-card--flush', selected && 'pn-card--selected', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {children}
    </button>
  );
}
