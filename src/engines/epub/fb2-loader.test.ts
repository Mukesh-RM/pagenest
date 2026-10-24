// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-ignore jsdom has no bundled types in this repo
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadFoliateBook } from './book-loader';

const FB2 = join(__dirname, '../../features/reader/fixtures/alice.fb2');

beforeAll(() => {
  const dom = new JSDOM();
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.document = dom.window.document;
});

describe('fb2 loader', () => {
  it('opens alice.fb2 from bytes when the stored format is fb2', async () => {
    const bytes = readFileSync(FB2);
    const loaded = await loadFoliateBook('fb2', new Blob([bytes], { type: 'application/xml' }));
    expect(loaded.book.sections.length).toBeGreaterThan(0);
  });
});
