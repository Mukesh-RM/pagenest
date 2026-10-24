import type { CDPSession, Page } from '@playwright/test';

/** Mid-range phone emulation. Chromium only; other engines run unthrottled and the helper reports that. */
export async function throttleCpu(page: Page, rate: number): Promise<CDPSession | undefined> {
  if (rate <= 1 || page.context().browser()?.browserType().name() !== 'chromium') return undefined;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  return cdp;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

/** Records long tasks (over 50 ms) from the very start of every page load in this page. Call before `goto`. Read with `longTasks`. */
export async function recordLongTasks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __longTasks?: number[] };
    w.__longTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__longTasks!.push(e.duration);
      }).observe({ type: 'longtask', buffered: true });
    } catch { /* longtask is Chromium only */ }
  });
}

export function longTasks(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as unknown as { __longTasks?: number[] }).__longTasks ?? []);
}

export interface FrameStats { frames: number; p95Ms: number; maxMs: number; droppedRatio: number; scrolledPx: number }

/**
 * Flings the scroll position of `selector` (or of the whole page with 'document') at a constant speed for `seconds`, recording every requestAnimationFrame interval.
 * Main-thread work that delays frames (long tasks, layout storms) shows up as slow frames.
 */
export async function flingScroll(
  page: Page, selector: string, seconds: number, pxPerSecond: number, dropMs: number,
): Promise<FrameStats> {
  return page.evaluate(
    ({ selector, seconds, pxPerSecond, dropMs }) =>
      new Promise<FrameStats>((resolve) => {
        const el = selector === 'document' ? document.scrollingElement : document.querySelector(selector);
        if (!el) throw new Error(`Scroll container ${selector} not found`);
        const deltas: number[] = [];
        const startTop = el.scrollTop;
        let last = performance.now();
        const start = last;
        const step = (now: number) => {
          deltas.push(now - last);
          el.scrollTop += (pxPerSecond * (now - last)) / 1000;
          last = now;
          if (now - start < seconds * 1000) requestAnimationFrame(step);
          else {
            const sorted = [...deltas.slice(1)].sort((a, b) => a - b);
            const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)] ?? 0;
            resolve({
              frames: sorted.length,
              p95Ms: p95,
              maxMs: sorted[sorted.length - 1] ?? 0,
              droppedRatio: sorted.filter((d) => d > dropMs).length / Math.max(1, sorted.length),
              scrolledPx: el.scrollTop - startTop,
            });
          }
        };
        requestAnimationFrame(step);
      }),
    { selector, seconds, pxPerSecond, dropMs },
  );
}

/**
 * Installs pointerdown and keydown listeners that remembers the event time, then resolves latency as: first painted frame in which
 * `isDone()` is true, minus the pointerdown time. Use `armTap` before tapping and `tapLatency` after.
 */
export async function armTap(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __tapStart?: number };
    for (const type of ['pointerdown', 'keydown'] as const) {
      window.addEventListener(type, (e) => { w.__tapStart = e.timeStamp; }, { capture: true });
    }
  });
}

/** Waits (inside the page, frame by frame) until `predicateSource` returns true, then returns ms since pointerdown. */
export async function tapLatency(page: Page, predicateSource: string, timeoutMs = 2000): Promise<number> {
  return page.evaluate(
    ({ predicateSource, timeoutMs }) =>
      new Promise<number>((resolve, reject) => {
        const w = window as unknown as { __tapStart?: number };
        const done = new Function(`return (${predicateSource})`) as () => boolean;
        const begin = performance.now();
        const poll = () => {
          if (done()) {
            // the change is in the DOM; the user sees it on the next painted frame
            requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - (w.__tapStart ?? begin))));
          } else if (performance.now() - begin > timeoutMs) reject(new Error(`UI change did not appear within ${timeoutMs} ms`));
          else requestAnimationFrame(poll);
        };
        poll();
      }),
    { predicateSource, timeoutMs },
  );
}

/** Arms the listeners, runs `action` (the tap or typing), and returns ms from the input event to the painted result. */
export async function measureInput(page: Page, predicateSource: string, action: () => Promise<unknown>, timeoutMs = 2000): Promise<number> {
  await armTap(page);
  const wait = tapLatency(page, predicateSource, timeoutMs);
  wait.catch(() => {}); // if the action itself fails first, report that error rather than an unhandled rejection
  await action();
  return wait;
}
