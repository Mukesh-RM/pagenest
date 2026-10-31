import { cx } from '../utils/cx';

export interface AppMarkProps {
  /** Pixel size of the square mark. Default 72. */
  size?: number;
  className?: string;
}

/**
 * The InkQuiet mark (headphones around an open book) drawn from the theme tokens, so it is right in every theme
 * including Custom. Decorative: the heading next to it names the app.
 */
export function AppMark({ size = 72, className }: AppMarkProps) {
  return (
    <svg className={cx('pn-appmark', className)} viewBox="0 0 512 512" width={size} height={size} aria-hidden="true" focusable="false">
      <rect className="pn-appmark__tile" width="512" height="512" rx="112" />
      <path className="pn-appmark__band" d="M150 214 C150 124 362 124 362 214" />
      <rect className="pn-appmark__cup" x="134" y="206" width="32" height="64" rx="16" />
      <rect className="pn-appmark__cup" x="346" y="206" width="32" height="64" rx="16" />
      <path className="pn-appmark__page" d="M256 232 C222 208 176 206 148 218 V372 C178 362 224 366 256 392 Z" />
      <path className="pn-appmark__page pn-appmark__page--right" d="M256 232 C290 208 336 206 364 218 V372 C334 362 288 366 256 392 Z" />
    </svg>
  );
}
