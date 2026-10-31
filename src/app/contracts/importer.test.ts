import { describe, expect, expectTypeOf, it } from 'vitest';
import type { BookImporter, ImportOutcome, ImportResult, SampleBookProvider } from '.';

/** A fake the Library bot's real provider must be assignable to (it also implements the sample contract). */
function fakeLibrary(): BookImporter & SampleBookProvider {
  const added = new Set<string>();
  const add = async (name: string): Promise<ImportOutcome> => {
    if (name.endsWith('.drm')) return { fileName: name, error: 'This file is protected, so InkQuiet cannot open it.' };
    const result: ImportResult = { bookId: name, kind: 'ebook', format: 'epub', title: name, alreadyInLibrary: added.has(name) };
    added.add(name);
    return { fileName: name, result };
  };
  return {
    accept: '.epub,.pdf,.mp3,.m4b',
    available: () => true,
    importFiles: (files) => Promise.all(files.map((f) => add(f.name))),
    info: { title: 'T', author: 'A', license: 'Public domain', provenance: 'P' },
    importSample: async () => {
      const outcome = await add('sample.epub');
      if ('error' in outcome) throw new Error(outcome.error);
      return outcome.result;
    },
  };
}

describe('BookImporter contract', () => {
  it('one object can implement both BookImporter and SampleBookProvider', () => {
    const lib = fakeLibrary();
    expectTypeOf(lib).toMatchTypeOf<BookImporter>();
    expectTypeOf(lib).toMatchTypeOf<SampleBookProvider>();
    expectTypeOf<BookImporter['importFiles']>().parameter(0).toEqualTypeOf<readonly File[]>();
    expectTypeOf<BookImporter['importFiles']>().returns.toEqualTypeOf<Promise<readonly ImportOutcome[]>>();
  });

  it('outcomes narrow on result vs error and keep the input order', async () => {
    const files = [new File(['1'], 'a.epub'), new File(['2'], 'b.drm'), new File(['3'], 'c.epub')];
    const outcomes = await fakeLibrary().importFiles(files);
    expect(outcomes.map((o) => o.fileName)).toEqual(['a.epub', 'b.drm', 'c.epub']);
    const [a, b] = outcomes as [ImportOutcome, ImportOutcome];
    if (!('result' in a)) throw new Error('expected a result');
    expect(a.result.alreadyInLibrary).toBe(false);
    if (!('error' in b)) throw new Error('expected an error');
    expect(b.error).not.toMatch(/Error:|\bat \w/);
  });

  it('importing the same file again reports alreadyInLibrary and does not throw', async () => {
    const lib = fakeLibrary();
    await lib.importFiles([new File(['1'], 'a.epub')]);
    const [again] = await lib.importFiles([new File(['1'], 'a.epub')]);
    expect(again && 'result' in again && again.result.alreadyInLibrary).toBe(true);
  });

  it('the sample goes through the same path as picked files', async () => {
    const lib = fakeLibrary();
    expect((await lib.importSample()).alreadyInLibrary).toBe(false);
    expect((await lib.importSample()).alreadyInLibrary).toBe(true);
  });
});
