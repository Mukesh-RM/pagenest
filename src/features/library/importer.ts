import type { BookImporter, ImportOutcome, SampleBookProvider } from '@/app/contracts';
import type { ItemOutcome } from '@/workers/import/protocol';
import type { ImportController } from './import-controller';
import { getImportController } from './registry';
import { createSampleBookProvider, type SampleDeps } from './sample';

/**
 * The file picker shows every file. InkQuiet decides what a file is from its content (magic
 * bytes), never from its name, extension or the type the browser guesses, so the picker must not
 * hide a file because of how it is named.
 */
export const ACCEPT_ANY_FILE = '*/*';

const NOT_ADDED = 'This file could not be added. Nothing was changed.';

export interface BookImporterDeps {
  controller?: () => ImportController;
  /** False when this browser cannot run the import worker. */
  canRun?: () => boolean;
}

/**
 * The importer the app registers as `AppServices.importer` (contract: `src/app/contracts/importer.ts`).
 * It runs the real import path (content sniffing, fingerprint, metadata, OPFS, `books` row) in the
 * import worker and shares the progress with the Library screen's own import status.
 */
export function createBookImporter(deps: BookImporterDeps = {}): BookImporter {
  const controller = deps.controller ?? getImportController;
  const canRun = deps.canRun ?? (() => typeof Worker !== 'undefined');
  return {
    accept: ACCEPT_ANY_FILE,
    available: () => canRun(),
    async importFiles(files: readonly File[]): Promise<readonly ImportOutcome[]> {
      if (files.length === 0) return [];
      const byIndex = new Map<number, ItemOutcome>();
      await controller().importFiles(
        files.map((file) => ({ file })),
        (outcome) => {
          byIndex.set(outcome.index, outcome);
        },
      );
      return files.map((file, index): ImportOutcome => toOutcome(file.name, byIndex.get(index)));
    },
  };
}

function toOutcome(fileName: string, outcome: ItemOutcome | undefined): ImportOutcome {
  if (outcome?.status === 'added') {
    const { book } = outcome;
    return { fileName, result: { bookId: book.id, kind: book.kind, format: book.format, title: book.title, alreadyInLibrary: false } };
  }
  if (outcome?.status === 'duplicate') {
    return { fileName, result: { bookId: outcome.bookId, kind: outcome.kind, format: outcome.format, title: outcome.title, alreadyInLibrary: true } };
  }
  if (outcome?.status === 'unsupported') return { fileName, error: outcome.message };
  return { fileName, error: NOT_ADDED };
}

/** The one object the app registers twice: `{ ...services, importer: library, sampleBook: library }`. */
export type LibraryProvider = BookImporter & SampleBookProvider;

/**
 * Importer and sample book in one object (docs/IMPORTER_CONTRACT.md). Both go through the same import
 * worker and controller, so a sample added with a tap behaves exactly like a file the person picked.
 */
export function createLibraryProvider(deps: BookImporterDeps & SampleDeps = {}): LibraryProvider {
  const importer = createBookImporter(deps);
  const sample = createSampleBookProvider(deps);
  return {
    accept: importer.accept,
    available: () => importer.available(),
    importFiles: (files) => importer.importFiles(files),
    info: sample.info,
    importSample: () => sample.importSample(),
  };
}
