import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons';
import { cx } from '../utils/cx';

/**
 * primary: filled teal. secondary: soft tinted fill, no outline. ghost: text only.
 * danger: quiet red text. danger-solid: filled red, reserved for the confirm button inside ConfirmDialog.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid';

interface ButtonBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  /** Deprecated and ignored: every button shares one height (44 px), radius and type size. Kept so existing calls compile. */
  size?: 'md' | 'lg';
  block?: boolean;
  /** Icon shown before the label. */
  icon?: IconName;
}

export interface LabelButtonProps extends ButtonBaseProps {
  children: ReactNode;
  iconOnly?: false;
}

/** An icon-only button has no visible text, so an accessible name is mandatory. */
export interface IconButtonProps extends ButtonBaseProps {
  iconOnly: true;
  icon: IconName;
  'aria-label': string;
  children?: never;
}

export type ButtonProps = LabelButtonProps | IconButtonProps;

/** Pill button. Minimum 44 x 44 px, visible focus ring, three emphasis levels plus danger. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  const { variant = 'primary', size: _size, block, icon, iconOnly, className, type = 'button', children, ...rest } = props;
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'pn-btn',
        `pn-btn--${variant}`,
        iconOnly && 'pn-btn--icon',
        block && 'pn-btn--block',
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} /> : null}
      {iconOnly ? null : children}
    </button>
  );
});
