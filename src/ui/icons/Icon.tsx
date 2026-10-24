import { createElement } from 'react';
import { ICON_NODES, type IconName } from './nodes';

export interface IconProps {
  name: IconName;
  /** Pixel size; the design system default is 24. */
  size?: number;
  /** Accessible name. Leave empty for decorative icons (they are hidden from screen readers). */
  label?: string;
  className?: string;
}

/** Lucide outline icon, 24 px grid, 2 px stroke, colored by `currentColor`. */
export function Icon({ name, size = 24, label, className }: IconProps) {
  const nodes = ICON_NODES[name];
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={className ? `pn-icon ${className}` : 'pn-icon'}
      data-icon={name}
      {...a11y}
    >
      {nodes.map(([tag, attrs], i) => createElement(tag, { ...attrs, key: i }))}
    </svg>
  );
}

export type { IconName };
