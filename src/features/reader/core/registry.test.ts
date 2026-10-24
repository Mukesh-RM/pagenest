import { describe, expect, it, vi } from 'vitest';
import type { BookFormat } from '@/app/contracts';
import { readerError } from './errors';
import type { ReaderDocumentExt, ReaderEngineExt } from './ext-types';
import { openStoredBook, ReaderRegistry, sourceFor } from './registry';

/** An engine that records what it was asked to open. */
function fakeEngine(label: string) {
  const open = vi.fn(async () => ({ label }) as unknown as ReaderDocumentExt);
  const engine = { open, formats: [] } as unknown as ReaderEngineExt;
  return { engine, open };
}

const host = document.createElement('div');

/**
 * A file's name, extension and MIME type say nothing here: the Library stored the real format, found from the bytes, and
 * the reader routes by that alone. Each case is a file whose name points at a different engine than its stored format.
 */
const ODD_NAMES: ReadonlyArray<{ name: string; type: string; stored: BookFormat }> = [
  { name: 'book.epub__1_', type: '', stored: 'epub' },
  { name: 'no-extension', type: '', stored: 'pdf' },
  { name: 'scan.txt', type: 'text/plain', stored: 'pdf' },
  { name: 'ALICE (1).EPUB', type: 'application/epub+zip', stored: 'epub' },
  { name: 'alice.epub', type: 'application/epub+zip', stored: 'mobi' },
  { name: 'alice.zip', type: 'application/zip', stored: 'docx' },
  { name: 'alice.pdf', type: 'application/pdf', stored: 'txt' },
  { name: 'Ünïcödé — 名前.PDF.bak', type: 'application/octet-stream', stored: 'fb2' },
  { name: '.hidden', type: '', stored: 'cbz' },
  { name: 'a.b.c.d.epub.pdf.mobi', type: 'image/png', stored: 'epub' },
];

describe('format routing', () => {
  it.each(ODD_NAMES)('opens "$name" ($type) with the engine for its stored format "$stored"', async ({ name, type, stored }) => {
    const epub = fakeEngine('epub-engine');
    const pdf = fakeEngine('pdf-engine');
    const other = fakeEngine('other-engine');
    const registry = new ReaderRegistry()
      .register({ id: 'epub', formats: ['epub'], load: async () => epub.engine })
      .register({ id: 'pdf', formats: ['pdf'], load: async () => pdf.engine })
      .register({ id: 'other', formats: ['mobi', 'docx', 'txt', 'fb2', 'cbz'], load: async () => other.engine });
    const file = new File(['x'], name, { type });
    await openStoredBook(registry, { id: 'b1', format: stored }, file, host);
    const expected = stored === 'epub' ? epub : stored === 'pdf' ? pdf : other;
    expect(expected.open).toHaveBeenCalledTimes(1);
    for (const e of [epub, pdf, other]) if (e !== expected) expect(e.open).not.toHaveBeenCalled();
    const source = (expected.open.mock.calls[0] as unknown as [{ format: string; file: Blob; bookId: string }])[0];
    expect(source.format).toBe(stored);
    expect(source.bookId).toBe('b1');
    expect(source.file).toBe(file);
  });

  it('hands the engine the stored format and the bytes, never a name', () => {
    const file = new File(['x'], 'whatever.pdf', { type: 'application/pdf' });
    const source = sourceFor({ id: 'b9', format: 'epub' }, file);
    expect(Object.keys(source).sort()).toEqual(['bookId', 'file', 'format']);
    expect(source.format).toBe('epub');
  });

  it('works with a plain Blob that has no name at all', async () => {
    const epub = fakeEngine('epub-engine');
    const registry = new ReaderRegistry().register({ id: 'epub', formats: ['epub'], load: async () => epub.engine });
    await openStoredBook(registry, { id: 'b2', format: 'epub' }, new Blob(['x']), host);
    expect(epub.open).toHaveBeenCalledTimes(1);
  });

  it('says "unsupported" for a stored format no engine handles, instead of guessing from the file', async () => {
    const registry = new ReaderRegistry().register({ id: 'epub', formats: ['epub'], load: async () => fakeEngine('e').engine });
    await expect(openStoredBook(registry, { id: 'b3', format: 'pdf' }, new File(['x'], 'book.epub'), host)).rejects.toMatchObject({ code: 'unsupported' });
    expect(registry.canOpen('pdf')).toBe(false);
    expect(registry.canOpen('epub')).toBe(true);
  });

  it('loads an engine once, however many books use it, and does not load engines nobody asked for', async () => {
    const load = vi.fn(async () => fakeEngine('epub').engine);
    const never = vi.fn(async () => fakeEngine('pdf').engine);
    const registry = new ReaderRegistry().register({ id: 'epub', formats: ['epub'], load }).register({ id: 'pdf', formats: ['pdf'], load: never });
    await openStoredBook(registry, { id: 'a', format: 'epub' }, new Blob(['x']), host);
    await openStoredBook(registry, { id: 'b', format: 'epub' }, new Blob(['y']), host);
    expect(load).toHaveBeenCalledTimes(1);
    expect(never).not.toHaveBeenCalled();
  });

  it('retries loading an engine that failed to load', async () => {
    const load = vi.fn<() => Promise<ReaderEngineExt>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(fakeEngine('epub').engine);
    const registry = new ReaderRegistry().register({ id: 'epub', formats: ['epub'], load });
    await expect(registry.engineFor('epub')).rejects.toThrow('offline');
    await Promise.resolve();
    await expect(registry.engineFor('epub')).resolves.toBeDefined();
  });

  it('refuses two engines for one format', () => {
    const registry = new ReaderRegistry().register({ id: 'a', formats: ['epub'], load: async () => fakeEngine('a').engine });
    expect(() => registry.register({ id: 'b', formats: ['epub', 'mobi'], load: async () => fakeEngine('b').engine })).toThrow(/already registered/);
  });

  it('keeps the unsupported code on a reader error', () => {
    expect(readerError('unsupported').code).toBe('unsupported');
  });
});
