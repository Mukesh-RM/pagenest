import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { BookFormat } from '@/app/contracts';
import { isLocator } from '@/app/contracts';
import type { OpenOptions, ReaderSource } from '@/engines/reader/types';
import { DEFAULT_APPEARANCE } from '@/features/reader/core/appearance';
import { readerError, throwIfAborted, toReaderError } from '@/features/reader/core/errors';
import type { ReaderEngineExt } from '@/features/reader/core/ext-types';
import { PDF_FORMATS } from './formats';
import type { PageAnchor } from './page-layout';
import { PdfReaderDocument } from './pdf-document';
import './pdf.css';
import { loadPdfjs } from './pdfjs';
import { createBlobRangeTransport, looksLikePdf } from './range-transport';

const HEAD_BYTES = 128 * 1024;

export interface PdfEngineOptions {
  /**
   * Where pdf.js finds its optional data (CJK cmaps, the 14 standard fonts, JPX and JBIG2 decoders): a folder URL
   * ending in "/". Leave unset to use system fonts and skip those decoders.
   */
  readonly assetsBaseUrl?: string;
}

/** Map what pdf.js throws to the three plain-word failures the reader screen shows. */
export function pdfErrorCode(error: unknown): 'drm' | 'corrupt' | 'aborted' {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'PasswordException') return 'drm';
  if (name === 'AbortException' || name === 'AbortError') return 'aborted';
  return 'corrupt';
}

/** PDF engine: pdf.js in a worker, continuous scroll, tiled and lazy canvases, text layer, outline, search. */
export class PdfEngine implements ReaderEngineExt {
  readonly id = 'pdfjs';
  readonly formats: readonly BookFormat[] = PDF_FORMATS;
  readonly #options: PdfEngineOptions;

  constructor(options: PdfEngineOptions = {}) {
    this.#options = options;
  }

  canOpen(format: BookFormat): boolean {
    return this.formats.includes(format);
  }

  async open(source: ReaderSource, host: HTMLElement, options?: OpenOptions): Promise<PdfReaderDocument> {
    // The stored format decides. Nothing here looks at a file name or extension.
    if (!this.canOpen(source.format)) throw readerError('unsupported');
    throwIfAborted(options?.signal);
    if (source.file.size === 0 || !(await looksLikePdf(source.file))) throw readerError('corrupt');

    const lib = await loadPdfjs();
    throwIfAborted(options?.signal);
    const head = new Uint8Array(await source.file.slice(0, Math.min(HEAD_BYTES, source.file.size)).arrayBuffer());
    const transport = createBlobRangeTransport(lib.PDFDataRangeTransport, source.file, head);
    const base = this.#options.assetsBaseUrl;
    const task = lib.getDocument({
      range: transport,
      rangeChunkSize: 256 * 1024,
      disableAutoFetch: true,
      disableStream: true,
      enableXfa: false,
      ...(base ? { cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/` } : {}),
    });
    const onAbort = (): void => void task.destroy();
    options?.signal?.addEventListener('abort', onAbort, { once: true });

    let pdf: PDFDocumentProxy;
    try {
      pdf = await task.promise;
    } catch (error) {
      options?.signal?.removeEventListener('abort', onAbort);
      void task.destroy();
      throw readerError(pdfErrorCode(error), undefined, error);
    }
    if (pdf.numPages < 1) {
      void task.destroy();
      throw readerError('corrupt');
    }

    const saved = options?.locator;
    const start: PageAnchor =
      saved && isLocator(saved) && saved.kind === 'page'
        ? { page: Math.min(Math.max(1, saved.page), pdf.numPages), offset: saved.offset }
        : saved && isLocator(saved) && saved.kind === 'reflow'
          ? { page: Math.min(Math.max(1, saved.section + 1), pdf.numPages), offset: 0 }
          : { page: 1, offset: 0 };

    const doc = new PdfReaderDocument({
      pdf,
      host,
      appearance: options?.appearance ?? DEFAULT_APPEARANCE,
      start,
      destroy: () => {
        options?.signal?.removeEventListener('abort', onAbort);
        void task.destroy();
      },
    });
    try {
      await doc.start(start, options?.signal);
    } catch (error) {
      await doc.close();
      throw toReaderError(error);
    }
    return doc;
  }
}
