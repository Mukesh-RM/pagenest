import { cpus, loadavg } from 'node:os';
import type { CDPSession, Page } from '@playwright/test';

/** Mid-range phone emulation. Chromium only; other engines run unthrottled and the helper reports that. */
export async function throttleCpu(page: Page, rate: number): Promise<CDPSession | undefined> {
  if (rate <= 1 || page.context().browser()?.browserType().name() !== 'chromium') return undefined;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  return cdp;
}

/** 1-minute load average per CPU core of the machine running the tests (1 = every core busy). */
export function machineLoadPerCore(): number {
  return loadavg()[0]! / Math.max(1, cpus().length);
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
 * Scrolls the page with REAL touch input (CDP Input.dispatchTouchEvent: touchStart, a paced series of touchMove, touchEnd,
 * repeated as successive swipes, through the browser's input pipeline and compositor exactly as a finger does) and records
 * every requestAnimationFrame interval while it runs. Unlike `flingScroll` (which sets scrollTop from script) this exercises
 * touch-action, scroll chaining and compositor scrolling. Needs a Chromium context with `hasTouch` (the Pixel 7 projects).
 *
 * Why not Input.synthesizeScrollGesture with source "touch"? In headless Chromium it does nothing: the page stays at
 * scrollTop 0 while the call returns normally, which is how an earlier harness measured jank on a page that never moved.
 *
 * It FAILS LOUDLY if the page did not actually move: `scrolledPx` must reach `minShare` (default 40 %) of what the swipes
 * asked for, so a gesture that goes nowhere can never produce a green run.
 */
export async function touchScroll(page: Page, seconds: number, pxPerSecond: number, dropMs: number, opts: { minShare?: number } = {}): Promise<FrameStats> {
  if (page.context().browser()?.browserType().name() !== 'chromium') throw new Error('touchScroll needs Chromium (CDP Input.dispatchTouchEvent)');
  const cdp = await page.context().newCDPSession(page);
  const scroller = '(document.scrollingElement ?? document.documentElement)';
  const view = await page.evaluate((sel) => ({ w: innerWidth, h: innerHeight, top: eval(sel).scrollTop as number, max: (eval(sel).scrollHeight - innerHeight) as number }), scroller);
  const wanted = Math.min(Math.round(pxPerSecond * seconds), Math.max(0, view.max - view.top));
  if (wanted < 200) throw new Error(`touchScroll: the page has only ${Math.round(view.max - view.top)} px left to scroll; nothing to measure`);
  await page.evaluate(() => {
    const w = window as unknown as { __rafDeltas: number[]; __rafStop: boolean };
    w.__rafDeltas = []; w.__rafStop = false;
    let last = performance.now();
    const tick = (now: number) => { w.__rafDeltas.push(now - last); last = now; if (!w.__rafStop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const x = Math.round(view.w / 2);
  const swipe = Math.round(view.h * 0.6);
  const y0 = Math.round(view.h * 0.85);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const t0 = Date.now();
  let asked = 0;
  while (Date.now() - t0 < seconds * 1000 && asked < wanted) {
    const len = Math.min(swipe, wanted - asked);
    const began = Date.now();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (;;) {
      const done = Math.min(len, ((Date.now() - began) / 1000) * pxPerSecond);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 - done) }] });
      if (done >= len) break;
      await sleep(8);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    asked += len;
  }
  const gestureMs = Date.now() - t0;
  await sleep(150); // let the compositor finish the last fling frames
  const { deltas, after } = await page.evaluate((sel) => {
    const w = window as unknown as { __rafDeltas: number[]; __rafStop: boolean };
    w.__rafStop = true;
    return { deltas: w.__rafDeltas.slice(1), after: eval(sel).scrollTop as number };
  }, scroller);
  await cdp.detach().catch(() => {});
  const scrolledPx = after - view.top;
  if (!(scrolledPx >= asked * (opts.minShare ?? 0.4))) {
    throw new Error(`touchScroll: the touch gesture did not scroll the page (swipes asked ${asked} px, scrollTop ${Math.round(view.top)} -> ${Math.round(after)}, ${gestureMs} ms). Not measuring jank on a page that did not move: check touch-action, overflow and that the context has hasTouch.`);
  }
  return {
    frames: deltas.length,
    p95Ms: percentile(deltas, 95),
    maxMs: Math.max(0, ...deltas),
    droppedRatio: deltas.filter((d) => d > dropMs).length / Math.max(1, deltas.length),
    scrolledPx,
  };
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
