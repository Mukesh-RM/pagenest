import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons';
import { cx } from '../utils/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  /** "lg" is 52 px tall (still on the 4 px grid); the default is 44 px. */
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
  const { variant = 'primary', size = 'md', block, icon, iconOnly, className, type = 'button', children, ...rest } = props;
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'pn-btn',
        `pn-btn--${variant}`,
        size === 'lg' && 'pn-btn--lg',
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
