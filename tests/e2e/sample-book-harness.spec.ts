import { expect, test } from '@playwright/test';
import { readerTextReport, whyNotRealText } from './support/reader';

// Harness self-check for the sample-book gate: the detector must accept real prose and reject placeholder screens.
const PROSE = Array.from({ length: 5 }, (_, i) => `<p>It was a bright cold day in April, and the clocks were striking thirteen, said the keeper of the orchard to nobody in particular, paragraph ${i}. The apples had not yet fallen, but the wind carried the smell of them across the hills and down into the quiet village, where every window was shuttered against the evening.</p>`).join('');
const page = (body: string) => `<!doctype html><meta name="viewport" content="width=device-width"><header><h1>Reader</h1><button>Back</button></header><main>${body}</main><nav><a href="/">Library</a></nav>`;

test.describe('sample book gate harness', () => {
  test('real prose passes', async ({ page: p }) => {
    await p.setContent(page(PROSE));
    expect(whyNotRealText(await readerTextReport(p))).toBeNull();
  });

  for (const [name, body, why] of [
    ['the "arrives in a later release" placeholder', '<p role="note">The reader arrives in a later release. Your place in this book is saved on this device and will be used when it does.</p>', /placeholder copy/],
    ['a title card with no text', '<h2>The Quiet Orchard</h2><p>M. Author</p><p>Not started yet</p>', /paragraph/],
    ['one short paragraph', '<p>It was a bright cold day in April and the clocks were striking thirteen across the whole of the quiet orchard village.</p>', /paragraph/],
    ['Lorem ipsum filler', Array.from({ length: 5 }, () => '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim.</p>').join(''), /placeholder copy/],
    ['ids and numbers instead of prose', Array.from({ length: 5 }, () => `<p>${Array.from({ length: 40 }, (_, i) => `0x${i}f3a9`).join(' ')}</p>`).join(''), /not prose/],
  ] as const) {
    test(`${name} is rejected`, async ({ page: p }) => {
      await p.setContent(page(body));
      expect(whyNotRealText(await readerTextReport(p))).toMatch(why);
    });
  }
});
