import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A browser profile that survives closing, so "close the app and open it again" keeps storage. */
export async function persistentContext(projectUse, dir = mkdtempSync(join(tmpdir(), 'pn-profile-'))) {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } = projectUse;
  const context = await chromium.launchPersistentContext(dir, {
    ...(viewport ? { viewport } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(deviceScaleFactor ? { deviceScaleFactor } : {}),
    ...(isMobile !== undefined ? { isMobile } : {}),
    ...(hasTouch !== undefined ? { hasTouch } : {}),
    ...(baseURL ? { baseURL } : {}),
  });
  return { context, dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

export const noise = (msg) => /sandbox|React DevTools|Download the React/.test(msg);

/** Collect console errors, page errors and CSP violations; `errors` stays empty on a clean run. */
export function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !noise(m.text())) errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** The frame foliate renders the book into (a blob: document inside the paginator's shadow root). */
export function bookFrame(page) {
  return page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith('blob:'));
}

/** Wait until real book text is on screen; resolves with the frame's text (at least `min` characters). */
export async function waitForBookText(page, { needle, min = 200, timeout = 15000 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    for (const f of page.frames()) {
      if (f === page.mainFrame() || !f.url().startsWith('blob:')) continue;
      const text = await f.evaluate(() => document.body?.innerText ?? '').catch(() => '');
      if (text.length >= min && (!needle || text.includes(needle))) return text;
    }
    if (Date.now() > deadline) throw new Error(`No book text appeared within ${timeout} ms${needle ? ` (looking for "${needle}")` : ''}`);
    await page.waitForTimeout(50);
  }
}

/** First launch to the sample book: Skip, then "Add the sample book". Two taps. */
export async function openSampleFromFirstLaunch(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Add the sample book' }).click();
}

/** The saved reading position for a book, straight from IndexedDB (what survives a kill). */
export async function savedPosition(page, bookId) {
  return page.evaluate(async (id) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('pagenest');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const rows = await new Promise((resolve, reject) => {
      const req = db.transaction('progress').objectStore('progress').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.find((r) => r.bookId === id && r.mode === 'read') ?? null;
  }, bookId);
}

/** The reader's visible state: scrubber value, the percent text in the footer and the chapter line. */
export async function readerState(page) {
  return {
    scrub: await page.locator('.pn-scrubber__input').inputValue(),
    scrubText: await page.locator('.pn-scrubber__input').getAttribute('aria-valuetext'),
    chapter: await page.locator('.pn-reader__chapter').innerText(),
  };
}

/** Wait until the position stops changing (page turns and relocation have settled). */
export async function settled(page, ms = 700) {
  const read = async () => JSON.stringify(await readerState(page));
  let last = await read();
  let since = Date.now();
  while (Date.now() - since < ms) {
    await page.waitForTimeout(100);
    const now = await read();
    if (now !== last) {
      last = now;
      since = Date.now();
    }
  }
  return last;
}

/** A picture of the page area, for "the same spot" checks. The welcome-back card is dismissed first. */
export async function pagePicture(page) {
  await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 800 }).catch(() => undefined);
  await settled(page);
  return page.locator('.pn-live__host').screenshot({ animations: 'disabled' });
}

/**
 * How different two pictures of the page are: the share of pixels that differ by more than a small tolerance. The same
 * page drawn twice can differ in a few anti-aliased pixels (pictures are resampled), so "same spot" is a tiny ratio,
 * while a page off by a line or two differs by several percent.
 */
export async function pictureDiff(page, a, b) {
  return page.evaluate(
    async ([x, y]) => {
      const load = (b64) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = `data:image/png;base64,${b64}`;
        });
      const [ia, ib] = await Promise.all([load(x), load(y)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return 1;
      const data = (img) => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, c.width, c.height).data;
      };
      const da = data(ia);
      const db = data(ib);
      let differing = 0;
      for (let i = 0; i < da.length; i += 4) {
        if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 60) differing++;
      }
      return differing / (da.length / 4);
    },
    [a.toString('base64'), b.toString('base64')],
  );
}
