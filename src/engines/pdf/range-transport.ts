import type { PDFDataRangeTransport as RangeTransport } from 'pdfjs-dist';

/** Bytes that open with `%PDF-` (the PDF header may follow up to 1 KiB of junk, per the spec). */
export async function looksLikePdf(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const text = new TextDecoder('latin1').decode(head);
  return text.includes('%PDF-');
}

/**
 * Serve pdf.js byte ranges straight from a Blob (an OPFS `File`), so a 50 MB document is never read whole:
 * pdf.js asks for the end of the file (xref), the first page objects, and so on, and each request is a cheap slice.
 */
export function createBlobRangeTransport(
  PDFDataRangeTransport: typeof RangeTransport,
  file: Blob,
  initialData: Uint8Array,
): RangeTransport {
  const transport = new PDFDataRangeTransport(file.size, initialData);
  transport.requestDataRange = (begin: number, end: number): void => {
    const to = Math.min(end, file.size);
    void file
      .slice(begin, to)
      .arrayBuffer()
      .then((buffer) => transport.onDataRange(begin, new Uint8Array(buffer)))
      .catch(() => transport.onDataRange(begin, null));
  };
  return transport;
}
