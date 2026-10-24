import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Wait until the app has created its IndexedDB (Dexie opens it on first use). */
async function dbReady(page) {
  await page.waitForFunction(async () => (await indexedDB.databases()).some((d) => d.name === 'pagenest'), null, { timeout: 15000 });
}

/**
 * Put a fixture into the app the way the Library does: bytes into OPFS under books/<id>/<storedName>, and a row in
 * the `books` store with the stored format and kind.
 */
export async function seedBook(page, book, id = crypto.randomUUID()) {
  await page.goto('/');
  await dbReady(page);
  await page.evaluate(
    async ({ id, book }) => {
      const root = await navigator.storage.getDirectory();
      let dir = root;
      for (const part of ['books', id]) dir = await dir.getDirectoryHandle(part, { create: true });
      const handle = await dir.getFileHandle(book.storedName, { create: true });
      const writable = await handle.createWritable();
      const res = await fetch(`/__fixture/${encodeURIComponent(book.fixture)}`);
      await res.body.pipeTo(writable);
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('pagenest');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('books', 'readwrite');
        tx.objectStore('books').put({
          id,
          fingerprint: `e2e:${id}`,
          kind: book.kind,
          format: book.format,
          title: book.title,
          author: 'Lewis Carroll',
          fileRef: `books/${id}/${book.storedName}`,
          addedAt: Date.now(),
          favorite: false,
          finished: false,
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { id, book },
  );
  return id;
}

/** Read the saved reading position for a book straight from IndexedDB (what survives a kill). */
export async function savedPosition(page, id) {
  return page.evaluate(async (id) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('pagenest');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const row = await new Promise((resolve, reject) => {
      const req = db.transaction('progress').objectStore('progress').get([id, 'read']);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return row ?? null;
  }, id);
}

/** Open the reader and wait until the page is on screen. Returns how long that took in ms. */
export async function openReader(page, id) {
  const t0 = Date.now();
  await page.goto(`/read/${id}`);
  await page.locator('.pn-reader__status').waitFor({ timeout: 30000 });
  return Date.now() - t0;
}

/** A browser profile that survives closing, so "kill the app and reopen" keeps storage. */
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

/** Wait until the visible position text stops changing (page turns and scrolls have settled). */
export async function settled(page, ms = 700) {
  const read = () => page.locator('.pn-reader__scrub-value').innerText();
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

/** What the reader shows right now, for comparing "the same spot": the position text and a picture of the page. */
export async function readingSpot(page) {
  await page.locator('.pn-welcome button').click({ timeout: 1000 }).catch(() => undefined);
  const chromeShown = await page.locator('.pn-reader__root').getAttribute('data-chrome');
  if (chromeShown === 'shown') await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const position = await settled(page);
  const chapter = await page.locator('.pn-reader__status-left').innerText().catch(() => '');
  const picture = await page.locator('.pn-reader__host').screenshot({ animations: 'disabled' });
  return { position, chapter, picture };
}

export const noise = (msg) => /sandbox|React DevTools|Download the React/.test(msg);

/** Collect console errors and page errors; `errors` stays empty on a clean run. */
export function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !noise(m.text())) errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}
