import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeServices } from '@/app/test-utils';
import type { AppServices } from '@/app/services-context';
import { makeEpub, makeMp3, makePdf } from '@/workers/import/testing/fixtures';
import { ACCEPT_ANY_FILE, createBookImporter } from './importer';
import { resetImportController, setImportBackend } from './registry';
import { inProcessBackend } from './testing/in-process-backend';
import { polyfillBlob } from './testing/blob-polyfill';

let services: AppServices;

beforeAll(polyfillBlob);
beforeEach(() => {
  services = makeServices('book-importer');
  resetImportController();
  setImportBackend(() => inProcessBackend(services.db));
});
afterEach(async () => {
  resetImportController();
  services.covers.dispose();
  services.data.close();
  services.db.close();
  await services.db.delete();
});

const file = (bytes: BlobPart, name: string, type = ''): File => new File([bytes], name, { type });

describe('BookImporter (contract in src/app/contracts/importer.ts)', () => {
  it('lets the picker show every file, because type is decided by content', () => {
    const importer = createBookImporter();
    expect(importer.accept).toBe(ACCEPT_ANY_FILE);
    expect(importer.accept).toBe('*/*');
  });

  it('is available when a worker can run and not otherwise', () => {
    expect(createBookImporter({ canRun: () => true }).available()).toBe(true);
    expect(createBookImporter({ canRun: () => false }).available()).toBe(false);
  });

  it('imports nothing and resolves with nothing for an empty choice', async () => {
    expect(await createBookImporter().importFiles([])).toEqual([]);
  });

  it('gives one outcome per file, in the order chosen, whatever the files are called', async () => {
    const importer = createBookImporter();
    const epub = await makeEpub({ title: 'Hidden Epub', author: 'A. Writer' });
    const outcomes = await importer.importFiles([
      file(epub as BlobPart, 'holiday-photo.jpg', 'image/jpeg'), // an EPUB wearing a picture's name and type
      file(makePdf({ title: 'Plain Pdf' }) as BlobPart, 'README', 'text/plain'), // a PDF with no extension
      file(makeMp3({ title: 'Song', frames: 60 }) as BlobPart, 'track.bin', 'application/octet-stream'),
      file(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 'novel.epub', 'application/epub+zip'), // named like a book, is not one
    ]);
    expect(outcomes.map((o) => o.fileName)).toEqual(['holiday-photo.jpg', 'README', 'track.bin', 'novel.epub']);
    const [first, second, third, fourth] = outcomes;
    expect(first).toMatchObject({ result: { kind: 'ebook', format: 'epub', title: 'Hidden Epub', alreadyInLibrary: false } });
    expect(second).toMatchObject({ result: { kind: 'pdf', format: 'pdf', alreadyInLibrary: false } });
    expect(third).toMatchObject({ result: { kind: 'audio', format: 'mp3', alreadyInLibrary: false } });
    expect(fourth).toHaveProperty('error');
    const error = (fourth as { error: string }).error;
    expect(error.length).toBeGreaterThan(10);
    expect(error).not.toMatch(/Error|undefined|\bat \w+\.|0x|\{/);
    expect(await services.db.books.count()).toBe(3);
    const stored = await services.db.books.get((first as { result: { bookId: string } }).result.bookId);
    expect(stored?.format).toBe('epub');
  });

  it('says plainly when a file is already in the library, with the same book id', async () => {
    const importer = createBookImporter();
    const bytes = await makeEpub({ title: 'Twice' });
    const [one] = await importer.importFiles([file(bytes as BlobPart, 'a.epub')]);
    const [two] = await importer.importFiles([file(bytes as BlobPart, 'copy of a (1)')]);
    expect(one).toMatchObject({ result: { alreadyInLibrary: false } });
    expect(two).toMatchObject({ result: { alreadyInLibrary: true, kind: 'ebook', format: 'epub', title: 'Twice' } });
    expect((two as { result: { bookId: string } }).result.bookId).toBe((one as { result: { bookId: string } }).result.bookId);
    expect(await services.db.books.count()).toBe(1);
  });

  it('answers a repeated file inside one choice with the same book, not two', async () => {
    const importer = createBookImporter();
    const bytes = await makeEpub({ title: 'Doubled' });
    const outcomes = await importer.importFiles([file(bytes as BlobPart, 'x'), file(bytes as BlobPart, 'y')]);
    expect(outcomes).toHaveLength(2);
    expect(await services.db.books.count()).toBe(1);
    expect(outcomes.every((o) => 'result' in o)).toBe(true);
  });
});
