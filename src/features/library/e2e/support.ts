import { expect, type CDPSession, type Page } from '@playwright/test';

/** Helpers for the Library e2e tests. The measuring helpers follow the same method as QA's budgets (tests/perf). */

export async function throttleCpu(page: Page, rate: number): Promise<CDPSession | undefined> {
  if (rate <= 1) return undefined;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  return cdp;
}

/** Records long tasks (50 ms or more) from the start of every page load. Call before `goto`. */
export async function recordLongTasks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __longTasks: number[] };
    w.__longTasks = [];
    (w as unknown as { __longLog: [number, number][] }).__longLog = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          w.__longTasks.push(e.duration);
          (w as unknown as { __longLog: [number, number][] }).__longLog.push([Math.round(e.startTime), Math.round(e.duration)]);
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      /* longtask is Chromium only */
    }
  });
}

export const longTasks = (page: Page): Promise<number[]> => page.evaluate(() => (window as unknown as { __longTasks?: number[] }).__longTasks ?? []);
export const resetLongTasks = (page: Page): Promise<void> => page.evaluate(() => void ((window as unknown as { __longTasks: number[] }).__longTasks = []));
export const consoleErrors = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __errors?: string[] }).__errors ?? []);

export interface FrameStats {
  frames: number;
  p95Ms: number;
  maxMs: number;
  droppedRatio: number;
  scrolledPx: number;
}

/** Flings the page scroll at a constant speed, recording every animation frame interval. */
export function flingScroll(page: Page, seconds: number, pxPerSecond: number, dropMs: number): Promise<FrameStats> {
  return page.evaluate(
    ({ seconds, pxPerSecond, dropMs }) =>
      new Promise<FrameStats>((resolve) => {
        const el = document.scrollingElement as Element;
        const deltas: number[] = [];
        const startTop = el.scrollTop;
        let last = performance.now();
        const start = last;
        const step = (now: number): void => {
          deltas.push(now - last);
          el.scrollTop += (pxPerSecond * (now - last)) / 1000;
          last = now;
          if (now - start < seconds * 1000) requestAnimationFrame(step);
          else {
            const sorted = deltas.slice(1).sort((a, b) => a - b);
            const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)] ?? 0;
            resolve({ frames: sorted.length, p95Ms: p95, maxMs: sorted[sorted.length - 1] ?? 0, droppedRatio: sorted.filter((d) => d > dropMs).length / Math.max(1, sorted.length), scrolledPx: el.scrollTop - startTop });
          }
        };
        requestAnimationFrame(step);
      }),
    { seconds, pxPerSecond, dropMs },
  );
}

/** Time from the last input event to the painted frame in which `predicateSource` is true. */
export async function measureInput(page: Page, predicateSource: string, action: () => Promise<unknown>, timeoutMs = 3000): Promise<number> {
  await page.evaluate(() => {
    const w = window as unknown as { __tapStart?: number };
    for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, (e) => void (w.__tapStart = e.timeStamp), { capture: true });
  });
  const wait = page.evaluate(
    ({ predicateSource, timeoutMs }) =>
      new Promise<number>((resolve, reject) => {
        const w = window as unknown as { __tapStart?: number };
        const done = new Function(`return (${predicateSource})`) as () => boolean;
        const begin = performance.now();
        const poll = (): void => {
          if (done()) requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - (w.__tapStart ?? begin))));
          else if (performance.now() - begin > timeoutMs) reject(new Error(`The change did not appear within ${timeoutMs} ms`));
          else requestAnimationFrame(poll);
        };
        poll();
      }),
    { predicateSource, timeoutMs },
  );
  wait.catch(() => undefined);
  await action();
  return wait;
}

/**
 * Wait until the page is at rest: the DOM has not changed for `quietMs`, a frame has been drawn since, and the
 * browser reports idle time. This is the signal to use before timing a tap: a fixed timer is too short on a slow
 * machine and too long on a fast one, and a tap that lands while covers or the list are still arriving measures that
 * work, not the tap. Gives up (and says so) after `maxMs`.
 */
export async function waitForQuiet(page: Page, quietMs = 300, maxMs = 8000): Promise<number> {
  return page.evaluate(
    ({ quietMs, maxMs }) =>
      new Promise<number>((resolve, reject) => {
        const begin = performance.now();
        let last = performance.now();
        const observer = new MutationObserver(() => void (last = performance.now()));
        observer.observe(document, { childList: true, subtree: true, attributes: true, characterData: true });
        const idle = (cb: () => void): void => {
          if ('requestIdleCallback' in window) window.requestIdleCallback(() => cb(), { timeout: 500 });
          else setTimeout(cb, 50);
        };
        const check = (): void => {
          const now = performance.now();
          if (now - begin > maxMs) {
            observer.disconnect();
            reject(new Error(`The page did not come to rest within ${maxMs} ms`));
          } else if (now - last >= quietMs) {
            requestAnimationFrame(() =>
              idle(() => {
                if (performance.now() - last >= quietMs) {
                  observer.disconnect();
                  resolve(performance.now() - begin);
                } else check();
              }),
            );
          } else setTimeout(check, 50);
        };
        check();
      }),
    { quietMs, maxMs },
  );
}

/** Seed the `books` store of the `pagenest` database directly, exactly as QA does (bare rows). Reloads. */
export async function seedBooks(page: Page, count: number): Promise<void> {
  const total = await page.evaluate(async (count) => {
    const open = indexedDB.open('pagenest');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const kinds = [['ebook', 'epub'], ['pdf', 'pdf'], ['audio', 'm4b'], ['ebook', 'mobi'], ['doc', 'docx']] as const;
    const now = Date.now();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite');
      const store = tx.objectStore('books');
      for (let i = 0; i < count; i += 1) {
        const n = String(i).padStart(5, '0');
        const [kind, format] = kinds[i % kinds.length] as readonly [string, string];
        const fav = i % 10 === 0;
        store.put({
          id: `perf-${n}`,
          fingerprint: `perf-fp-${n}`,
          kind,
          format,
          title: `${fav ? 'Starred ' : ''}Book ${n}${i % 100 === 0 ? ' Zebra' : ''}`,
          author: `Author ${i % 250}`,
          addedAt: now - i * 1000,
          favorite: fav,
          finished: i % 7 === 0,
          ...(kind === 'audio' ? { durationSec: 3600 + i } : {}),
          ...(kind === 'pdf' ? { pages: 100 + (i % 400) } : {}),
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const n = await new Promise<number>((resolve, reject) => {
      const r = db.transaction('books').objectStore('books').count();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return n;
  }, count);
  expect(total).toBeGreaterThanOrEqual(count);
  await page.reload();
}

/** The book cards (list items inside main), like QA's `bookCards`. */
export const cards = (page: Page) => page.getByRole('main').getByRole('listitem');
