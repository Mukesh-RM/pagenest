import { expect, test } from '@playwright/test';
import { openSampleFromFirstLaunch, waitForBookText } from './support/app.mjs';

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

test('note on a highlight is saved, listed in Notes, and removed', async ({ page }) => {
  await openSampleFromFirstLaunch(page);
  await waitForBookText(page, { min: 100 });
  await ensureYellowHighlight(page);
  await page.getByRole('button', { name: 'Bookmarks and highlights' }).click();
  const marks = page.getByRole('dialog', { name: 'Marks in this book' });
  await marks.getByRole('tab', { name: 'Highlights' }).click();
  await expect(marks.getByRole('tabpanel', { name: 'Highlights' }).getByRole('button').first()).toBeVisible({ timeout: 15000 });
  await marks.getByText('Add note').first().click();
  const editor = page.getByRole('dialog', { name: 'Note' });
  await editor.locator('textarea').fill('Remember this rabbit hole.');
  await editor.getByRole('button', { name: 'Save note' }).click();
  await expect(editor).toBeHidden({ timeout: 15000 });
  await marks.getByRole('tab', { name: 'Notes' }).click();
  await expect(marks.getByText('Remember this rabbit hole.')).toBeVisible();
  await marks.getByText('Remember this rabbit hole.').click();
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Delete note' }).click();
  await expect(editor).toBeHidden({ timeout: 15000 });
  await marks.getByRole('tab', { name: 'Notes' }).click();
  await expect(marks.getByText('Remember this rabbit hole.')).toHaveCount(0);
});
