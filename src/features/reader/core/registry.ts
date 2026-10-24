import type { BookFormat, EntityId } from '@/app/contracts';
import type { OpenOptions, ReaderSource } from '@/engines/reader/types';
import { readerError } from './errors';
import type { ReaderDocumentExt, ReaderEngineExt } from './ext-types';

/**
 * Format routing.
 *
 * The Library detects the real format of a file by its bytes and stores it in `books.format`. The reader routes to an
 * engine from THAT stored format and nothing else: never from a file name, an extension or a MIME type. A file named
 * "book.epub__1_", "report" or "scan.txt" (really a PDF) opens with the engine for its stored format.
 */

/** A lazily loaded engine: the heavy code is only fetched when a book of one of its formats is opened. */
export interface EngineEntry {
  readonly id: string;
  readonly formats: readonly BookFormat[];
  load(): Promise<ReaderEngineExt>;
}

/** The slice of a `books` row the reader needs. `format` is the stored, content-detected format. */
export interface StoredBook {
  readonly id: EntityId;
  readonly format: BookFormat;
}

export class ReaderRegistry {
  readonly #entries: EngineEntry[] = [];
  readonly #loaded = new Map<string, Promise<ReaderEngineExt>>();

  register(entry: EngineEntry): this {
    for (const format of entry.formats) {
      if (this.#entries.some((e) => e.formats.includes(format))) throw new Error(`A reader engine for "${format}" is already registered.`);
    }
    this.#entries.push(entry);
    return this;
  }

  /** Engine entry that opens `format`, or `undefined`. */
  entryFor(format: BookFormat): EngineEntry | undefined {
    return this.#entries.find((e) => e.formats.includes(format));
  }

  canOpen(format: BookFormat): boolean {
    return this.entryFor(format) !== undefined;
  }

  formats(): BookFormat[] {
    return this.#entries.flatMap((e) => [...e.formats]);
  }

  async engineFor(format: BookFormat): Promise<ReaderEngineExt> {
    const entry = this.entryFor(format);
    if (!entry) throw readerError('unsupported');
    let loading = this.#loaded.get(entry.id);
    if (!loading) {
      loading = entry.load();
      this.#loaded.set(entry.id, loading);
      loading.catch(() => this.#loaded.delete(entry.id));
    }
    return loading;
  }
}

/** Build the source an engine opens. Only the stored `format` is used. */
export function sourceFor(book: StoredBook, file: Blob): ReaderSource {
  return { bookId: book.id, format: book.format, file };
}

/** Open a stored book with the engine for its stored format. */
export async function openStoredBook(
  registry: ReaderRegistry,
  book: StoredBook,
  file: Blob,
  host: HTMLElement,
  options?: OpenOptions,
): Promise<ReaderDocumentExt> {
  const engine = await registry.engineFor(book.format);
  return engine.open(sourceFor(book, file), host, options);
}
