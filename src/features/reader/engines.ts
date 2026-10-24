import { DOCUMENT_FORMATS, FOLIATE_FORMATS } from '@/engines/epub/formats';
import { PDF_FORMATS } from '@/engines/pdf/formats';
import { ReaderRegistry } from './core/registry';

export interface DefaultRegistryOptions {
  /** Folder URL (ending in "/") with pdf.js cmaps, standard fonts and wasm decoders, when the app ships them. */
  readonly pdfAssetsBaseUrl?: string;
}

/**
 * The reader's engines. Each one is loaded the first time a book of one of its formats opens, so the app shell stays
 * small: pdf.js, foliate-js and mammoth.js are separate chunks.
 *
 * Routing is by stored format (`books.format`, detected from the file's bytes by the Library). New formats are new
 * entries here; the reader screen never changes.
 */
export function createDefaultRegistry(options: DefaultRegistryOptions = {}): ReaderRegistry {
  return new ReaderRegistry()
    .register({
      id: 'pdfjs',
      formats: PDF_FORMATS,
      load: async () => new (await import('@/engines/pdf/pdf-engine')).PdfEngine(options.pdfAssetsBaseUrl ? { assetsBaseUrl: options.pdfAssetsBaseUrl } : {}),
    })
    .register({
      id: 'foliate',
      formats: FOLIATE_FORMATS,
      load: async () => new (await import('@/engines/epub/epub-engine')).FoliateEngine(),
    })
    .register({
      id: 'documents',
      formats: DOCUMENT_FORMATS,
      load: async () => new (await import('@/engines/epub/epub-engine')).DocumentEngine(),
    });
}
