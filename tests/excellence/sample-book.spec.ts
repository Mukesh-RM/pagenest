import { expect, test } from '@playwright/test';
import { launch, waitForBookText } from '../e2e/support/app';
import { readerTextReport, whyNotRealText, REAL_TEXT } from '../e2e/support/reader';

// Gate: "Try a sample book" on the empty Library must lead to a book that opens on REAL text, not a placeholder.
// Flow: first launch -> Skip onboarding -> empty Library -> "Try a sample book" -> add it -> open it -> the reader shows prose.
// Owners: Library (the sample provider and the card), Reader (the screen that must render the text).

test('the sample book opens on real text, not a placeholder', async ({ page }) => {
  test.setTimeout(180_000);
  await launch(page);
  const card = page.getByRole('region', { name: /try a sample book/i });
  await expect(card, 'the empty Library offers no "Try a sample book" card (no sample provider registered or available): owner Library').toBeVisible({ timeout: 10_000 });
  await card.getByRole('button', { name: /add the sample book/i }).click();

  // the Library may open the book itself; otherwise open it from the shelf
  const opened = await page.waitForURL(/\/(read|listen)\//, { timeout: 15_000 }).then(() => true, () => false);
  if (!opened) {
    await expect(page.locator('main li, main [role=listitem]').first(), 'the sample book did not appear in the Library after adding it').toBeVisible({ timeout: 10_000 });
    await page.locator('main li, main [role=listitem]').first().click();
    const detail = page.getByRole('dialog').getByRole('button', { name: /^(read|continue|open|start)/i }).first();
    if (await detail.isVisible().catch(() => false)) await detail.click();
    await page.waitForURL(/\/(read|listen)\//, { timeout: 15_000 });
  }
  expect(page.url(), 'the sample book is text: it must open in the reader, not the audio player').toMatch(/\/read\//);

  await expect(page.getByRole('button', { name: 'Back to library' }).first()).toBeVisible({ timeout: 90_000 });
  await waitForBookText(page, { min: 200, timeout: 120_000 });

  const report = await readerTextReport(page);
  const why = whyNotRealText(report);
  expect(why, `the sample book opened on something that is not real text (${why}). On screen: "${report.sample}"; need ${REAL_TEXT.minParagraphs}+ paragraphs, ${REAL_TEXT.minProseChars}+ characters`).toBeNull();
});
