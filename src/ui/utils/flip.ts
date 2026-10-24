import { prefersReducedMotion, readDurationMs } from './motion';

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The transform that maps the final box onto the first box: translate, then uniform-ish scale. */
export function flipTransform(first: RectLike, last: RectLike): { x: number; y: number; scaleX: number; scaleY: number } {
  const w = last.width || 1;
  const h = last.height || 1;
  return {
    x: first.left + first.width / 2 - (last.left + last.width / 2),
    y: first.top + first.height / 2 - (last.top + last.height / 2),
    scaleX: first.width / w,
    scaleY: first.height / h,
  };
}

/**
 * FLIP shared-element transition (First, Last, Invert, Play) for a cover that grows from its grid card into a
 * sheet or player. Only `transform` and `opacity` are animated, with the Web Animations API, so the work stays on
 * the compositor. Skipped when the user asked for reduced motion, or when there is no origin to grow from.
 * Returns the animation (or undefined) so callers can cancel it.
 */
export function playFlip(element: HTMLElement, first: RectLike | undefined, durationMs?: number): Animation | undefined {
  if (!first || prefersReducedMotion() || typeof element.animate !== 'function') return undefined;
  const last = element.getBoundingClientRect();
  if (last.width === 0 || last.height === 0) return undefined;
  const t = flipTransform(first, last);
  const duration = durationMs ?? readDurationMs('--pn-duration-slow', 250);
  if (duration <= 0) return undefined;
  return element.animate(
    [
      { transform: `translate(${t.x}px, ${t.y}px) scale(${t.scaleX}, ${t.scaleY})`, opacity: 0.85 },
      { transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
    ],
    { duration, easing: 'cubic-bezier(0, 0, 0.2, 1)', fill: 'none' },
  );
}

/** Snapshot the box of an element, to hand to {@link playFlip} later. */
export function measure(element: Element | null | undefined): RectLike | undefined {
  if (!element) return undefined;
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
}
