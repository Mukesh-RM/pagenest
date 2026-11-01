import type { Frame, Page } from '@playwright/test';
import { waitForBookText } from './app';

function isFoliateContentFrame(frame: Frame, main: Frame): boolean {
  if (frame === main) return false;
  const url = frame.url();
  if (url.startsWith('blob:') || url === 'about:blank') return true;
  // WebKit live smoke: book text often lands in non-blob child frames after sandbox strip.
  if (!url.startsWith('http')) return true;
  return false;
}

/** Foliate EPUB iframe that actually contains book text (there may be empty blob frames). */
export async function foliateBookFrame(page: Page, needle?: string): Promise<Frame | undefined> {
  let best: { frame: Frame; len: number } | undefined;
  const main = page.mainFrame();
  for (const frame of page.frames()) {
    if (!isFoliateContentFrame(frame, main)) continue;
    const text = await frame.evaluate(() => document.body?.innerText ?? '').catch(() => '');
    if (needle && !text.includes(needle)) continue;
    if (!best || text.length > best.len) best = { frame, len: text.length };
  }
  return best?.frame;
}

/** Wait until reflow book text is visible in a foliate iframe. */
export async function waitForFoliateBookText(
  page: Page,
  options?: { min?: number; needle?: string; timeout?: number },
): Promise<string> {
  const min = options?.min ?? 200;
  const needle = options?.needle;
  const deadline = Date.now() + (options?.timeout ?? 90_000);
  let polls = 0;
  for (;;) {
    const hostText = await page
      .evaluate(() => {
        const view = document.querySelector('foliate-view') as
          | (HTMLElement & { renderer?: { getContents: () => Array<{ doc: Document }> } })
          | null;
        return view?.renderer?.getContents?.()[0]?.doc?.body?.innerText ?? '';
      })
      .catch(() => '');
    if (hostText.length >= min && (!needle || hostText.includes(needle))) return hostText;
    const main = page.mainFrame();
    for (const frame of page.frames()) {
      if (!isFoliateContentFrame(frame, main)) continue;
      const frameText = await frame.evaluate(() => document.body?.innerText ?? '').catch(() => '');
      if (frameText.length >= min && (!needle || frameText.includes(needle))) return frameText;
    }
    if (Date.now() > deadline) {
      throw new Error(`Foliate book text did not appear within ${options?.timeout ?? 90_000} ms`);
    }
    if (polls++ % 40 === 0) await dismissReaderInterstitials(page).catch(() => undefined);
    await page.waitForTimeout(50);
  }
}

const LIVE_FOLIATE_TEXT_TIMEOUT_MS = 240_000;

function liveFoliateTextTimeout(requested?: number): number {
  if (process.env.PAGENEST_SMOKE_LIVE !== '1') return requested ?? 120_000;
  const floor = LIVE_FOLIATE_TEXT_TIMEOUT_MS;
  return Math.max(requested ?? floor, floor);
}

/** Live smoke: longer foliate wait + one reload retry (WebKit + service worker). */
export async function waitForFoliateBookTextLive(
  page: Page,
  options?: { min?: number; needle?: string; timeout?: number },
): Promise<string> {
  const timeout = liveFoliateTextTimeout(options?.timeout);
  try {
    return await waitForFoliateBookText(page, { ...options, timeout });
  } catch (first) {
    if (process.env.PAGENEST_SMOKE_LIVE !== '1') throw first;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissReaderInterstitials(page);
    return waitForFoliateBookText(page, { ...options, timeout });
  }
}

/** Tap a left/center/right zone on the live reader (immersive chrome + foliate/PDF tap handling). */
export async function tapReaderZone(page: Page, zone: 'left' | 'center' | 'right'): Promise<void> {
  const article = page.locator('article.pn-reader__page');
  await article.waitFor({ state: 'visible', timeout: 30_000 });
  const box = await article.boundingBox();
  if (!box) throw new Error('Reader page has no layout box.');
  const x = zone === 'left' ? box.width * 0.12 : zone === 'right' ? box.width * 0.88 : box.width * 0.5;
  const y = box.height * 0.45;
  await article.click({ position: { x, y } });
}

/** Dismiss welcome, iOS install sheet, and similar overlays on the reader route. */
export async function dismissReaderInterstitials(page: Page): Promise<void> {
  await page.getByRole('dialog', { name: 'Add InkQuiet to your iPhone' }).waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined);
  await page.getByRole('button', { name: 'Got it' }).click({ timeout: 2000 }).catch(() => undefined);
  await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 2000 }).catch(() => undefined);
}

/** Select a phrase inside the foliate iframe and notify foliate's selectionchange handler. */
export async function selectPhraseInFoliate(page: Page, phrase: string): Promise<void> {
  const ok = await page.evaluate((needle) => {
    const view = document.querySelector('foliate-view') as
      | (HTMLElement & { renderer?: { getContents: () => Array<{ doc: Document }> } })
      | null;
    const docs = view?.renderer?.getContents?.().map((c) => c.doc) ?? [];
    for (const doc of docs) {
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const idx = node.data.indexOf(needle);
        if (idx < 0) continue;
        const range = doc.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + needle.length);
        const sel = doc.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        doc.dispatchEvent(new Event('selectionchange'));
        return true;
      }
    }
    return false;
  }, phrase);
  if (!ok) throw new Error(`Phrase not found in book: ${phrase}`);
  await page.getByRole('toolbar', { name: 'Selected text' }).waitFor({ state: 'visible', timeout: 10_000 });
}

/** Tap a word inside the foliate iframe (triggers {@link FoliateReaderDocument} word tap). */
export async function tapWordInFoliate(page: Page, word: string): Promise<void> {
  await waitForFoliateBookText(page, { needle: word, min: 20, timeout: 120_000 });

  const frame = await foliateBookFrame(page, word);
  if (!frame) throw new Error('No foliate book frame.');
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordRe = new RegExp(String.raw`\b${escaped}\b`, 'i');
  const hits = frame.getByText(wordRe);
  const count = await hits.count();
  for (let i = 0; i < count; i++) {
    const hit = hits.nth(i);
    const inTitle = await hit.evaluate((el) => !!el.closest('#pg-title-no-subtitle, title, h1'));
    if (inTitle) continue;
    await hit.click({ force: true, timeout: 5000 }).catch(() => undefined);
    break;
  }
  const ok = await page.evaluate((needle) => {
    const view = document.querySelector('foliate-view') as
      | (HTMLElement & { renderer?: { getContents: () => Array<{ doc: Document }> } })
      | null;
    const doc = view?.renderer?.getContents?.()[0]?.doc;
    if (!doc) return false;
    const escapedInner = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(String.raw`\b${escapedInner}\b`, 'i');
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.parentElement?.closest('#pg-title-no-subtitle, title, h1')) continue;
      const match = re.exec(node.data);
      if (!match || match.index === undefined) continue;
      const idx = match.index;
      const range = doc.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + match[0].length);
      const rect = range.getBoundingClientRect();
      const x = rect.width > 0 ? rect.left + rect.width / 2 : rect.left + 4;
      const y = rect.height > 0 ? rect.top + rect.height / 2 : rect.top + 8;
      doc.getSelection()?.removeAllRanges();
      const base = {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      };
      doc.dispatchEvent(new PointerEvent('pointerdown', { ...base, buttons: 1 }));
      doc.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0 }));
      return true;
    }
    return false;
  }, word);
  if (!ok) throw new Error(`Word not found in foliate book: ${word}`);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.evaluate((needle) => {
      document.querySelector('.pn-live__host')?.dispatchEvent(
        new CustomEvent('pn-mock-word-tap', { detail: { word: needle }, bubbles: true }),
      );
    }, word);
    if (await page.locator('.pn-dict-popup').isVisible().catch(() => false)) return;
    await page.waitForTimeout(400);
  }
}

export async function openSampleBookInReader(page: Page): Promise<void> {
  const waitText = async (timeout: number): Promise<void> => {
    await waitForBookText(page, { needle: 'Peter', min: 100, timeout }).catch(() =>
      waitForFoliateBookText(page, { needle: 'Peter', min: 100, timeout }),
    );
  };

  if (page.url().includes('/read/')) {
    await waitText(120_000);
    return;
  }
  await page.getByRole('heading', { level: 1, name: 'Library' }).waitFor({ state: 'visible' });
  const card = page.getByRole('region', { name: /try a sample book/i });
  const sampleAdd = card.getByRole('button', { name: /add the sample book/i });
  const sampleVisible = await sampleAdd
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (sampleVisible) {
    await sampleAdd.click({ timeout: 20_000 });
  } else {
    await page.getByRole('button', { name: /The Tale of Peter Rabbit/i }).first().click({ timeout: 15_000 });
  }

  const opened = await page.waitForURL(/\/(read|listen)\//, { timeout: 90_000 }).then(() => true, () => false);
  if (!opened) {
    await page.locator('main li, main [role=listitem]').first().click({ timeout: 15_000 });
    const detail = page.getByRole('dialog').getByRole('button', { name: /^(read|continue|open|start)/i }).first();
    if (await detail.isVisible().catch(() => false)) await detail.click();
    await page.waitForURL(/\/read\//, { timeout: 90_000 });
  }
  if (!page.url().match(/\/read\//)) {
    throw new Error(`Expected reader URL after opening sample book, got ${page.url()}`);
  }

  await dismissReaderInterstitials(page);
  await page.getByRole('button', { name: 'Back to library' }).first().waitFor({ timeout: 90_000 }).catch(() => undefined);
  await page.getByRole('heading', { level: 1, name: /Peter Rabbit/i }).waitFor({ timeout: 90_000 }).catch(() => undefined);
  try {
    await waitText(180_000);
  } catch {
    await page.getByRole('button', { name: 'Back to library' }).click({ timeout: 5000 }).catch(() => undefined);
    await page.getByRole('button', { name: /The Tale of Peter Rabbit/i }).first().click({ timeout: 15_000 });
    await page.waitForURL(/\/read\//, { timeout: 90_000 });
    await dismissReaderInterstitials(page);
    await waitText(180_000);
  }
}

export async function installDictionaryStarterPacks(page: Page): Promise<void> {
  const { gotoTab } = await import('./app');
  await gotoTab(page, 'Settings');
  await page.getByRole('heading', { name: /dictionary and translation/i }).waitFor({ timeout: 15_000 });
  const starterRow = page
    .getByText(/English definitions \(WordNet starter\)/i)
    .locator('xpath=ancestor::div[contains(@class,"pn-dict-settings__row")]');
  const starterBtn = starterRow.getByRole('button', { name: /^Download$/ });
  const starterInstalled = starterRow.getByRole('button', { name: /^Installed$/i });
  if (await starterInstalled.isVisible().catch(() => false)) return;
  if (await starterBtn.isVisible().catch(() => false)) await starterBtn.click();
  await starterInstalled.waitFor({ timeout: 30_000 });
}

export async function installHindiTranslationPack(page: Page): Promise<void> {
  const hiRow = page.getByText(/English ↔ Hindi/i).locator('xpath=ancestor::div[contains(@class,"pn-dict-settings__row")]');
  const hiInstalled = hiRow.getByRole('button', { name: /^Installed$/i });
  if (await hiInstalled.isVisible().catch(() => false)) return;
  const hiBtn = hiRow.getByRole('button', { name: /^Download$/ });
  if (await hiBtn.isVisible().catch(() => false)) await hiBtn.click();
  await hiInstalled.waitFor({ timeout: 30_000 });
}
