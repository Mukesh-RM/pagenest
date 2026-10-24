import { useEffect, useState } from 'react';

/** Parse a CSS time value such as "200ms", "0.25s" or "0". Returns NaN when it cannot be read. */
export function parseCssTime(value: string): number {
  const v = value.trim();
  if (v === '') return Number.NaN;
  if (v.endsWith('ms')) return Number.parseFloat(v);
  if (v.endsWith('s')) return Number.parseFloat(v) * 1000;
  return Number.parseFloat(v);
}

/**
 * Read a motion duration token (for example "--pn-duration-slow") in milliseconds.
 * Falls back to `fallback` when styles are not loaded (tests, SSR). Reduced motion makes the
 * tokens 0ms, so this also reports 0 when the user asked for less motion.
 */
export function readDurationMs(token: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token);
  const ms = parseCssTime(raw);
  return Number.isFinite(ms) ? ms : fallback;
}

/** True when the user prefers reduced motion (system setting, or the data-reduce-motion override). */
export function prefersReducedMotion(): boolean {
  if (typeof document === 'undefined') return false;
  const override = document.documentElement.getAttribute('data-reduce-motion');
  if (override === 'true') return true;
  if (override === 'false') return false;
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** React hook form of {@link prefersReducedMotion}; updates when the system setting changes. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const query = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const update = () => setReduced(prefersReducedMotion());
    update();
    query?.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
    return () => {
      query?.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);
  return reduced;
}
