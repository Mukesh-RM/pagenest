/**
 * Run `callback` once, when the browser is idle (or after a short delay where `requestIdleCallback`
 * does not exist, for example Safari). Returns a cancel function. Used to fetch and start code that
 * is not needed for the first paint.
 */
export function whenIdle(callback: () => void, timeoutMs = 3000): () => void {
  const w = window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
  if (typeof w.requestIdleCallback === 'function') {
    const handle = w.requestIdleCallback(callback, { timeout: timeoutMs });
    return () => w.cancelIdleCallback?.(handle);
  }
  const timer = window.setTimeout(callback, Math.min(timeoutMs, 1500));
  return () => window.clearTimeout(timer);
}
