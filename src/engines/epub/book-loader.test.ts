import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- test-only DOM for foliate parsers
// @ts-ignore jsdom has no bundled types in this repo
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BookFormat } from '@/app/contracts';
import { convertDocument } from './document-engine';
import { hasContentEncryption, isZipFile, loadFoliateBook, looksLikeXml, mobiEncryption } from './book-loader';
import { sourceFor } from '@/features/reader/core/registry';

const FIX = join(__dirname, '../../features/reader/fixtures');

beforeAll(() => {
  const dom = new JSDOM();
  globalThis.DOMParser = dom.window.DOMParser;
});

/** Vitest's Blob/File slice is incomplete; fixtures use a small File-like with arrayBuffer slices. */
function fixture(name: string): Blob {
  const bytes = new Uint8Array(readFileSync(join(FIX, name)));
  return {
    size: bytes.length,
    async arrayBuffer() {
      return Uint8Array.from(bytes).buffer;
    },
    slice(start = 0, end = bytes.length) {
      const part = bytes.subarray(start, end);
      return {
        async arrayBuffer() {
          return part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength);
        },
      } as Blob;
    },
  } as Blob;
}

const FOLIATE: ReadonlyArray<{ format: BookFormat; file: string; needle: RegExp }> = [
  { format: 'epub', file: 'alice.epub', needle: /Alice/i },
  { format: 'mobi', file: 'alice.mobi', needle: /Alice/i },
  { format: 'cbz', file: 'alice.cbz', needle: /./ },
];

describe('loadFoliateBook', () => {
  it.each(FOLIATE)('opens $file as stored format $format from bytes, not the name', async ({ format, file }) => {
    const loaded = await loadFoliateBook(format, fixture(file));
    expect(loaded.book.sections.length).toBeGreaterThan(0);
    if (format === 'cbz') expect(loaded.fixed).toBe(true);
    if (format === 'epub') expect(loaded.book.sections.length).toBeGreaterThan(1);
  });

  it('rejects a zip that is not an epub when format is epub', async () => {
    await expect(loadFoliateBook('epub', fixture('alice.cbz'))).rejects.toMatchObject({ code: 'corrupt' });
  });
});

describe('convertDocument', () => {
  it('converts alice.txt by stored format', async () => {
    const source = sourceFor({ id: 't', format: 'txt' }, fixture('alice.txt'));
    const { book } = await convertDocument(source);
    expect(book.sections?.length).toBeGreaterThan(0);
  });

  it('converts alice.docx by stored format', async () => {
    const { book } = await convertDocument(sourceFor({ id: 't', format: 'docx' }, fixture('alice.docx')));
    expect(book.sections?.length).toBeGreaterThan(0);
  });
});

describe('byte guards', () => {
  it('detects zip, xml and mobi encryption header', async () => {
    expect(await isZipFile(fixture('alice.epub'))).toBe(true);
    expect(await looksLikeXml(fixture('alice.fb2'))).toBe(true);
    expect(hasContentEncryption(null)).toBe(false);
    expect(await mobiEncryption(fixture('alice.mobi'))).toBe(0);
  });
});
