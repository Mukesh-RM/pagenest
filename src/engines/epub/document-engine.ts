import type { BookFormat } from '@/app/contracts';
import type { OpenOptions, ReaderSource } from '@/engines/reader/types';
import { readerError } from '@/features/reader/core/errors';
import type { ReaderEngineExt } from '@/features/reader/core/ext-types';
import { checkDocx, convertDocx } from './adapters/docx';
import { decodeText, htmlToSections, markdownToSections, plainTextToSections, rtfToText } from './adapters/text';
import { makeSyntheticBook, type SectionInput } from './adapters/synthetic-book';
import type { LoadedFoliateBook } from './book-loader';
import type { FoliateReaderDocument } from './foliate-document';
import { DOCUMENT_FORMATS } from './formats';
import { openWith } from './open-with';

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
      ({ title, sections } = htmlToSections(html, 'Beginning'));
      break;
    }
    case 'html': {
      ({ title, sections } = htmlToSections(decodeText(new Uint8Array(await file.arrayBuffer())).text, 'Beginning'));
      break;
    }
    case 'md':
      sections = markdownToSections(decodeText(new Uint8Array(await file.arrayBuffer())).text, 'Beginning');
      break;
    case 'rtf': {
      const raw = decodeText(new Uint8Array(await file.arrayBuffer())).text;
      if (!raw.trimStart().startsWith('{\\rtf')) throw readerError('corrupt');
      sections = plainTextToSections(rtfToText(raw), 'Beginning');
      break;
    }
    case 'txt':
      sections = plainTextToSections(decodeText(new Uint8Array(await file.arrayBuffer())).text, 'Beginning');
      break;
    default:
      throw readerError('unsupported');
  }
  const first = sections[0]?.title;
  return { book: makeSyntheticBook({ title: title || (sections.length === 1 ? first : undefined) || '', sections }), fixed: false };
}
