import type { ImportResult, SampleBookInfo, SampleBookProvider } from '@/app/contracts';
import type { ItemOutcome } from '@/workers/import/protocol';
import type { ImportController } from './import-controller';
import { getImportController } from './registry';
import sampleUrl from './sample/peter-rabbit.epub?url';

/** Shown on the "Try a sample book" card. Provenance and license are also in docs/LICENSES.md. */
export const SAMPLE_INFO: SampleBookInfo = {
  title: 'The Tale of Peter Rabbit',
  author: 'Beatrix Potter',
  license: 'Public domain in the USA',
  provenance: 'Project Gutenberg, ebook 14838',
};

const FAILED = 'Could not add the sample book. Check your connection and try again.';

export interface SampleDeps {
  /** Where the EPUB is fetched from. Our own origin only. */
  url?: string;
  fetchFn?: typeof fetch;
  controller?: () => ImportController;
  /** False when this browser cannot run the import worker. */
  canRun?: () => boolean;
}

/**
 * The sample book. Nothing is downloaded until `importSample()` runs (when the person taps), the
 * file comes from our own origin, is not precached, and goes through the normal import path.
 */
export function createSampleBookProvider(deps: SampleDeps = {}): SampleBookProvider {
  const url = deps.url ?? sampleUrl;
  const doFetch = deps.fetchFn ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const controller = deps.controller ?? getImportController;
  return {
    info: SAMPLE_INFO,
    available: () => (deps.canRun ? deps.canRun() : typeof Worker !== 'undefined' || deps.controller !== undefined),
    async importSample(): Promise<ImportResult> {
      let bytes: ArrayBuffer;
      try {
        const response = await doFetch(url, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`status ${response.status}`);
        bytes = await response.arrayBuffer();
      } catch {
        throw new Error(FAILED);
      }
      if (bytes.byteLength === 0) throw new Error(FAILED);
      const file = new File([bytes], 'The Tale of Peter Rabbit.epub', { type: 'application/epub+zip' });
      let outcome: ItemOutcome | undefined;
      await controller().importFiles([{ file }], (o: ItemOutcome) => {
        outcome = o;
      });
      if (outcome?.status === 'added') {
        return { bookId: outcome.book.id, kind: outcome.book.kind, format: outcome.book.format, title: outcome.book.title, alreadyInLibrary: false };
      }
      if (outcome?.status === 'duplicate') {
        return { bookId: outcome.bookId, kind: outcome.kind, format: outcome.format, title: outcome.title, alreadyInLibrary: true };
      }
      throw new Error(FAILED);
    },
  };
}
