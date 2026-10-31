import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSampleFromFirstLaunch, settled, waitForBookText, watchErrors } from './support/app.mjs';

const SHOTS = resolve(dirname(fileURLToPath(import.meta.url)), 'shots', 'phase2');
const themes = ['Light', 'Dark', 'Sepia', 'Black'];

async function ensureYellowHighlight(page) {
  await page.evaluate(() => {
    const doc = document.querySelector('foliate-view')?.renderer?.getContents?.()?.[0]?.doc;
    if (!doc) throw new Error('foliate document missing');
    const node = Array.from(doc.body.querySelectorAll('*'))
      .flatMap((el) => Array.from(el.childNodes))
      .find((n) => n.nodeType === 3 && n.data.includes('Rabbit'));
    if (!node) throw new Error('sample text missing');
    const range = doc.createRange();
    range.setStart(node, node.data.indexOf('Rabbit'));
    range.setEnd(node, node.data.indexOf('Rabbit') + 6);
    doc.getSelection()?.removeAllRanges();
    doc.getSelection()?.addRange(range);
  });
  const toolbar = page.getByRole('toolbar', { name: 'Selected text' });
  await expect(toolbar).toBeVisible({ timeout: 10000 });
  await toolbar.getByRole('button', { name: 'Highlight yellow' }).click();
}

async function applyTheme(page, theme) {
  await page.getByRole('button', { name: 'Reading settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reading settings' });
  await dialog.getByRole('radio', { name: new RegExp(theme) }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await settled(page, 400);
}

for (const width of [360, 430]) {
  for (const theme of themes) {
    test(`phase2 UI ${width} ${theme} search`, async ({ browser }, info) => {
      test.skip(info.project.name !== 'laptop', 'one project captures theme shots at fixed widths');
      mkdirSync(SHOTS, { recursive: true });
      const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, baseURL: info.project.use.baseURL });
      const page = await context.newPage();
      watchErrors(page);
      await openSampleFromFirstLaunch(page);
      await waitForBookText(page, { min: 100 });
      await applyTheme(page, theme);
      await page.getByRole('button', { name: 'Search in this book' }).click();
      const dialog = page.getByRole('dialog', { name: 'Search in this book' });
      await dialog.getByRole('searchbox').fill('rabbit');
      await dialog.getByRole('button', { name: 'Search' }).click();
      await expect(dialog.getByRole('list', { name: 'Search results' }).getByRole('button').first()).toBeVisible({ timeout: 20000 });
      await page.screenshot({ path: `${SHOTS}/search-${width}-${theme.toLowerCase()}.png` });
      await context.close();
    });

    test(`phase2 UI ${width} ${theme} marks`, async ({ browser }, info) => {
      test.skip(info.project.name !== 'laptop', 'one project captures theme shots at fixed widths');
      mkdirSync(SHOTS, { recursive: true });
      const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, baseURL: info.project.use.baseURL });
      const page = await context.newPage();
      await openSampleFromFirstLaunch(page);
      await waitForBookText(page, { min: 100 });
      await applyTheme(page, theme);
      await page.getByRole('button', { name: 'Bookmarks and highlights' }).click();
      await expect(page.getByRole('dialog', { name: 'Marks in this book' })).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/marks-${width}-${theme.toLowerCase()}.png` });
      await context.close();
    });

    test(`phase2 UI ${width} ${theme} notes`, async ({ browser }, info) => {
      test.skip(info.project.name !== 'laptop', 'one project captures theme shots at fixed widths');
      mkdirSync(SHOTS, { recursive: true });
      const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, baseURL: info.project.use.baseURL });
      const page = await context.newPage();
      await openSampleFromFirstLaunch(page);
      await waitForBookText(page, { min: 100 });
      await applyTheme(page, theme);
      await ensureYellowHighlight(page);
      await page.getByRole('button', { name: 'Bookmarks and highlights' }).click();
      const marks = page.getByRole('dialog', { name: 'Marks in this book' });
      await marks.getByRole('tab', { name: 'Highlights' }).click();
      await marks.getByText('Add note').first().click();
      const note = page.getByRole('dialog', { name: 'Note' });
      await note.locator('textarea').fill('A quiet note for the screenshot.');
      await note.getByRole('button', { name: 'Save note' }).click();
      await expect(note).toBeHidden({ timeout: 15000 });
      await marks.getByRole('tab', { name: 'Notes' }).click();
      await page.screenshot({ path: `${SHOTS}/notes-${width}-${theme.toLowerCase()}.png` });
      await context.close();
    });
  }
}
