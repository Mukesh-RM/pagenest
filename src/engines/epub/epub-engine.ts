import type { BookFormat } from '@/app/contracts';
import type { OpenOptions, ReaderSource } from '@/engines/reader/types';
import { DEFAULT_APPEARANCE } from '@/features/reader/core/appearance';
import { readerError, throwIfAborted, toReaderError } from '@/features/reader/core/errors';
import type { ReaderEngineExt } from '@/features/reader/core/ext-types';
import { checkDocx, convertDocx } from './adapters/docx';
import { decodeText, htmlToSections, markdownToSections, plainTextToSections, rtfToText } from './adapters/text';
import { makeSyntheticBook, type SectionInput } from './adapters/synthetic-book';
import { loadFoliateBook, type LoadedFoliateBook } from './book-loader';
import { DOCUMENT_FORMATS, FOLIATE_FORMATS } from './formats';
import { FoliateReaderDocument } from './foliate-document';

type Loader = (source: ReaderSource) => Promise<LoadedFoliateBook>;

/** Shared engine body: pick a loader, make a foliate view, open at the saved locator. */
async function openWith(load: Loader, source: ReaderSource, host: HTMLElement, options: OpenOptions | undefined): Promise<FoliateReaderDocument> {
  throwIfAborted(options?.signal);
  const loaded = await load(source);
  throwIfAborted(options?.signal);
  const appearance = options?.appearance ?? DEFAULT_APPEARANCE;
  await import('foliate-js/view.js'); // registers <foliate-view>
  const view = document.createElement('foliate-view') as unknown as ConstructorParameters<typeof FoliateReaderDocument>[0];
  view.style.display = 'block';
  view.style.width = '100%';
  view.style.height = '100%';
  host.append(view);
  const doc = new FoliateReaderDocument(view, { book: loaded.book, host, appearance, fixed: loaded.fixed });
  try {
    await view.open(loaded.book);
    await doc.start(options?.locator);
    throwIfAborted(options?.signal);
  } catch (error) {
    await doc.close();
    throw toReaderError(error);
  }
  return doc;
}

/** EPUB 2 and 3, MOBI, AZW3, FB2 and CBZ with foliate-js. Routed by the stored format only. */
export class FoliateEngine implements ReaderEngineExt {
  readonly id = 'foliate';
  readonly formats: readonly BookFormat[] = FOLIATE_FORMATS;

  canOpen(format: BookFormat): boolean {
    return this.formats.includes(format);
  }

  open(source: ReaderSource, host: HTMLElement, options?: OpenOptions): Promise<FoliateReaderDocument> {
    if (!this.canOpen(source.format)) return Promise.reject(readerError('unsupported'));
    return openWith((s) => loadFoliateBook(s.format, s.file), source, host, options);
  }
}

/** DOCX (mammoth.js), TXT, RTF, HTML and Markdown: converted to clean sections, then read like any e-book. */
export class DocumentEngine implements ReaderEngineExt {
  readonly id = 'documents';
  readonly formats: readonly BookFormat[] = DOCUMENT_FORMATS;

  canOpen(format: BookFormat): boolean {
    return this.formats.includes(format);
  }

  open(source: ReaderSource, host: HTMLElement, options?: OpenOptions): Promise<FoliateReaderDocument> {
    if (!this.canOpen(source.format)) return Promise.reject(readerError('unsupported'));
    return openWith(convertDocument, source, host, options);
  }
}

/** Convert a stored-format document into a foliate-compatible book. Exported for tests. */
export async function convertDocument(source: ReaderSource): Promise<LoadedFoliateBook> {
  const { file, format } = source;
  if (file.size === 0) throw readerError('corrupt');
  let title = '';
  let sections: SectionInput[];
  switch (format) {
    case 'docx': {
      await checkDocx(file);
      const { html } = await convertDocx(file);
      ({ title, sections } = htmlToSections(html, 'Document'));
      break;
    }
    case 'html': {
      ({ title, sections } = htmlToSections(decodeText(new Uint8Array(await file.arrayBuffer())).text, 'Document'));
      break;
    }
    case 'md':
      sections = markdownToSections(decodeText(new Uint8Array(await file.arrayBuffer())).text, 'Document');
      break;
    case 'rtf': {
      const raw = decodeText(new Uint8Array(await file.arrayBuffer())).text;
      if (!raw.trimStart().startsWith('{\\rtf')) throw readerError('corrupt');
      sections = plainTextToSections(rtfToText(raw), 'Document');
      break;
    }
    case 'txt':
      sections = plainTextToSections(decodeText(new Uint8Array(await file.arrayBuffer())).text, 'Text');
      break;
    default:
      throw readerError('unsupported');
  }
  const first = sections[0]?.title;
  return { book: makeSyntheticBook({ title: title || (sections.length === 1 ? first : undefined) || '', sections }), fixed: false };
}
