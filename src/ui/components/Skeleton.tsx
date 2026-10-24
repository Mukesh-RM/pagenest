import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../utils/cx';

export interface SkeletonProps {
  variant?: 'text' | 'rect' | 'circle';
  /** CSS size values (numbers are px). */
  width?: number | string;
  height?: number | string;
  className?: string;
}

/** Placeholder block. Decorative: hidden from screen readers (wrap in {@link SkeletonGroup}). */
export function Skeleton({ variant = 'text', width, height, className }: SkeletonProps) {
  const style: CSSProperties = { width, height };
  return <span aria-hidden="true" className={cx('pn-skeleton', `pn-skeleton--${variant}`, className)} style={style} />;
}

export interface SkeletonGroupProps {
  /** Announced to screen readers while loading. */
  label?: string;
  className?: string;
  children?: ReactNode;
}

/** Marks a loading region: one polite "Loading" announcement, the shapes themselves are silent. */
export function SkeletonGroup({ label = 'Loading', className, children }: SkeletonGroupProps) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="pn-visually-hidden">{label}</span>
      {children}
    </div>
  );
}

/** Library grid placeholder: cover (2:3) plus two text lines. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cx('pn-skeleton-card', className)} aria-hidden="true">
      <Skeleton variant="rect" />
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="text" width="50%" />
    </div>
  );
}
