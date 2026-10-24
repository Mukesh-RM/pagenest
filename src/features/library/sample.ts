import type { ImportResult, SampleBookInfo, SampleBookProvider } from '@/app/contracts';
import { getDb, type PageNestDB } from '@/data/db';
import { getLibraryController, type LibraryController } from './registry';
import sampleUrl from './sample/peter-rabbit.epub?url';

/** Shown on the "Try a sample book" card. Provenance and license are also in docs/LICENSES.md. */
export const SAMPLE_INFO: SampleBookInfo = {
  title: 'The Tale of Peter Rabbit',
  author: 'Beatrix Potter',
  license: 'Public domain',
  provenance: 'Project Gutenberg, ebook 14838',
};

const FAILED = 'Could not add the sample book. Check your connection and try again.';

export interface SampleDeps {
  /** Where the EPUB is fetched from. Our own origin only. */
  url?: string;
  fetchFn?: typeof fetch;
  controller?: () => LibraryController;
  db?: () => PageNestDB;
}

/**
 * The sample book. Nothing is downloaded until `importSample()` runs (when the person taps), the
 * file comes from our own origin, is not precached, and goes through the normal import path.
 */
export function createSampleBookProvider(deps: SampleDeps = {}): SampleBookProvider {
  const url = deps.url ?? sampleUrl;
  const doFetch = deps.fetchFn ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const controller = deps.controller ?? (() => getLibraryController(deps.db?.() ?? getDb()));
  const database = deps.db ?? getDb;
  return {
    info: SAMPLE_INFO,
    available: () => typeof Worker !== 'undefined' || deps.controller !== undefined,
    async importSample(): Promise<ImportResult> {
      let blob: Blob;
      try {
        const response = await doFetch(url, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`status ${response.status}`);
        blob = await response.blob();
      } catch {
        throw new Error(FAILED);
      }
      if (blob.size === 0) throw new Error(FAILED);
      const file = new File([blob], 'The Tale of Peter Rabbit.epub', { type: 'application/epub+zip' });
      let outcome: import('@/workers/import/protocol').ItemOutcome | undefined;
      await controller().importFiles([{ file }], (o) => {
        outcome = o;
      });
      if (outcome?.status === 'added') {
        return { bookId: outcome.book.id, kind: outcome.book.kind, title: outcome.book.title, alreadyInLibrary: false };
      }
      if (outcome?.status === 'duplicate') {
        const row = await database().books.get(outcome.bookId);
        return { bookId: outcome.bookId, kind: row?.kind ?? 'ebook', title: outcome.title, alreadyInLibrary: true };
      }
      throw new Error(FAILED);
    },
  };
}
