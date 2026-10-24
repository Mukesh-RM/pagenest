import type * as PdfJs from 'pdfjs-dist';

export type PdfJsModule = typeof PdfJs;

let loading: Promise<PdfJsModule> | undefined;

/**
 * Load pdf.js on first use (it is big, so it stays out of the app shell) and point it at its worker file. pdf.js
 * parses, decodes and measures text inside that worker; the main thread only draws canvases.
 */
export function loadPdfjs(): Promise<PdfJsModule> {
  loading ??= (async () => {
    const [lib, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  })();
  loading.catch(() => {
    loading = undefined;
  });
  return loading;
}
