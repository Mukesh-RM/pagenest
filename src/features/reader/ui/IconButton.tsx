import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '@/ui';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly icon: LucideIcon;
  /** Accessible name (mandatory: there is no visible text). */
  readonly label: string;
  readonly shortcut?: string;
  readonly pressed?: boolean;
}

/** 44 px ghost icon button, same look as the design system's icon-only Button. */
export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { icon: Glyph, label, shortcut, pressed, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cx('pn-btn', 'pn-btn--ghost', 'pn-btn--icon', className)}
      {...rest}
    >
      <Glyph size={24} strokeWidth={2} aria-hidden="true" focusable="false" />
    </button>
  );
});
