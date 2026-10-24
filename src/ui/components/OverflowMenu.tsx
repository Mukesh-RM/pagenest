import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon, type IconName } from '../icons';
import { cx } from '../utils/cx';

export interface OverflowMenuItem {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  /** Quiet red text for destructive rows ("Remove from library"). */
  danger?: boolean;
}

export interface OverflowMenuProps {
  /** Accessible name of the "⋯" button. Default "More options". */
  label?: string;
  items: OverflowMenuItem[];
  className?: string;
  children?: ReactNode;
}

/**
 * A "⋯" button that opens a small menu of rarely used or risky actions. Keyboard: Enter/Space/ArrowDown open it and
 * focus the first row, arrows move, Escape closes and returns focus to the button, Tab closes. A tap outside closes it.
 * The menu opens upward (it lives in sheet footers) and never moves the layout.
 */
export function OverflowMenu({ label = 'More options', items, className }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const rows = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const at = rows.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab' && open) {
      setOpen(false);
    } else if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && rows.length) {
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? (at + 1) % rows.length : (at - 1 + rows.length) % rows.length;
      rows[next]?.focus();
    } else if (!open && e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div ref={rootRef} className={cx('pn-overflow', className)} onKeyDown={onKeyDown}>
      <Button
        ref={buttonRef}
        variant="ghost"
        iconOnly
        icon="moreHorizontal"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      />
      {open ? (
        <div id={menuId} role="menu" aria-label={label} className="pn-overflow__menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={cx('pn-overflow__item', item.danger && 'pn-overflow__item--danger')}
              onClick={() => {
                close(false);
                item.onSelect();
              }}
            >
              {item.icon ? <Icon name={item.icon} size={20} /> : null}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
