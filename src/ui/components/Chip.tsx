import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons';
import { cx } from '../utils/cx';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  icon?: IconName;
  /**
   * Toggle state for filter chips ("Reading now", "Favorites"). When defined the chip is a
   * toggle button and exposes aria-pressed. Leave undefined for a plain action chip
   * (speed, sleep timer, chapters).
   */
  selected?: boolean;
}

/** Pill chip, minimum 44 px high, for filters and quick actions. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected, icon, className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected === undefined ? undefined : selected}
      className={cx('pn-chip', selected && 'pn-chip--selected', className)}
      {...rest}
    >
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </button>
  );
});

export interface ChipGroupProps {
  /** Accessible name of the group, for example "Filter library". */
  label: string;
  /** Scroll sideways instead of wrapping (phone filter rows). */
  scroll?: boolean;
  className?: string;
  children: ReactNode;
}

/** Labelled row of chips. */
export function ChipGroup({ label, scroll, className, children }: ChipGroupProps) {
  return (
    <div role="group" aria-label={label} className={cx('pn-chip-group', scroll && 'pn-chip-group--scroll', className)}>
      {children}
    </div>
  );
}
