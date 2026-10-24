import type { BookFormat } from '@/app/contracts';
import { readerError, toReaderError } from '@/features/reader/core/errors';

/**
 * Open a book file with foliate-js, choosing the parser from the STORED format (what the Library detected from the
 * bytes), never from a file name, extension or MIME type. foliate's own `makeBook` guesses from `file.name`, so it is
 * deliberately not used; each parser is called directly.
 *
 * The file's bytes are still checked here: if the stored format and the bytes disagree the file is reported as
 * damaged in plain words instead of crashing a parser.
 */

/** Formats foliate-js parses. */
export const FOLIATE_FORMATS = ['epub', 'mobi', 'azw3', 'fb2', 'cbz'] as const satisfies readonly BookFormat[];

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export async function isZipFile(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return ZIP_MAGIC.every((b, i) => head[i] === b);
}

/** Algorithms in `encryption.xml` that only obfuscate embedded fonts (not DRM). */
const FONT_OBFUSCATION = new Set(['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC']);

/** True when `encryption.xml` encrypts anything other than fonts. */
export function hasContentEncryption(encryptionXml: string | null | undefined): boolean {
  if (!encryptionXml) return false;
  const doc = new DOMParser().parseFromString(encryptionXml, 'application/xml');
  if (doc.querySelector('parsererror')) return false;
  for (const method of doc.getElementsByTagNameNS('*', 'EncryptionMethod')) {
    const algorithm = method.getAttribute('Algorithm') ?? '';
    if (!FONT_OBFUSCATION.has(algorithm)) return true;
  }
  return false;
}

interface ZipLoader {
  entries: Array<{ filename: string; uncompressedSize: number; directory?: boolean }>;
  loadText(name: string): Promise<string | null>;
  loadBlob(name: string, type?: string): Promise<Blob | null>;
  getSize(name: string): number;
  getComment(): Promise<string>;
}

/** Random-access zip over a Blob (an OPFS `File`): entries are inflated on demand, the archive is never read whole. */
export async function makeZipLoader(file: Blob): Promise<ZipLoader> {
  const { configure, ZipReader, BlobReader, TextWriter, BlobWriter } = await import('foliate-js/vendor/zip.js');
  configure({ useWebWorkers: false });
  const reader = new ZipReader(new BlobReader(file));
  const entries = await reader.getEntries();
  const map = new Map(entries.map((entry) => [entry.filename, entry]));
  return {
    entries,
    async loadText(name) {
      const entry = map.get(name);
      return entry ? ((await entry.getData(new TextWriter())) as string) : null;
    },
    async loadBlob(name, type) {
      const entry = map.get(name);
      return entry ? ((await entry.getData(new BlobWriter(type))) as Blob) : null;
    },
    getSize: (name) => map.get(name)?.uncompressedSize ?? 0,
    getComment: async () => (reader.comment ? new TextDecoder().decode(reader.comment) : ''),
  };
}

/** Encryption type from a MOBI/AZW header (0 = none, 1 and 2 = Mobipocket DRM). */
export async function mobiEncryption(file: Blob): Promise<number> {
  const pdb = new DataView(await file.slice(0, 82).arrayBuffer());
  if (pdb.byteLength < 82) return 0;
  const record0 = pdb.getUint32(78);
  const header = new DataView(await file.slice(record0, record0 + 16).arrayBuffer());
  return header.byteLength >= 14 ? header.getUint16(12) : 0;
}

export interface LoadedFoliateBook {
  readonly book: FoliateBook;
  /** Pages of a fixed layout (comic book, fixed-layout EPUB) are numbered; reflowable text is positioned by text. */
  readonly fixed: boolean;
}

export async function loadFoliateBook(format: BookFormat, file: Blob): Promise<LoadedFoliateBook> {
  try {
    if (file.size === 0) throw readerError('corrupt');
    switch (format) {
      case 'epub': {
        if (!(await isZipFile(file))) throw readerError('corrupt');
        const loader = await makeZipLoader(file);
        if (hasContentEncryption(await loader.loadText('META-INF/encryption.xml'))) throw readerError('drm');
        if ((await loader.loadText('META-INF/rights.xml')) !== null) throw readerError('drm');
        const { EPUB } = await import('foliate-js/epub.js');
        const book = await new EPUB(loader).init();
        return { book, fixed: book.rendition?.layout === 'pre-paginated' };
      }
      case 'cbz': {
        if (!(await isZipFile(file))) throw readerError('corrupt');
        const loader = await makeZipLoader(file);
        const { makeComicBook } = await import('foliate-js/comic-book.js');
        return { book: await makeComicBook(loader, { name: 'Comic book' }), fixed: true };
      }
      case 'mobi':
      case 'azw3': {
        const { isMOBI, MOBI } = await import('foliate-js/mobi.js');
        if (!(await isMOBI(file))) throw readerError('corrupt');
        if ((await mobiEncryption(file)) !== 0) throw readerError('drm');
        const { unzlibSync } = await import('foliate-js/vendor/fflate.js');
        return { book: await new MOBI({ unzlib: unzlibSync }).open(file), fixed: false };
      }
      case 'fb2': {
        const { makeFB2 } = await import('foliate-js/fb2.js');
        if (await isZipFile(file)) {
          // A zipped FictionBook: the book is the largest entry that is XML.
          const loader = await makeZipLoader(file);
          const candidates = [...loader.entries].filter((e) => !e.directory).sort((a, b) => b.uncompressedSize - a.uncompressedSize);
          for (const entry of candidates) {
            const blob = await loader.loadBlob(entry.filename);
            if (blob && (await looksLikeXml(blob))) return { book: await makeFB2(blob), fixed: false };
          }
          throw readerError('corrupt');
        }
        if (!(await looksLikeXml(file))) throw readerError('corrupt');
        return { book: await makeFB2(file), fixed: false };
      }
      default:
        throw readerError('unsupported');
    }
  } catch (error) {
    throw toReaderError(error);
  }
}

/** Whether the bytes begin like an XML document (after an optional byte order mark and whitespace). */
export async function looksLikeXml(blob: Blob): Promise<boolean> {
  const head = new TextDecoder('utf-8').decode(await blob.slice(0, 512).arrayBuffer()).replace(/^\uFEFF/, '').trimStart();
  return head.startsWith('<');
}
