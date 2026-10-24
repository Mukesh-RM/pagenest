import type { BookFormat } from '@/app/contracts';
import type { OpenOptions, ReaderSource } from '@/engines/reader/types';
import { readerError } from '@/features/reader/core/errors';
import type { ReaderEngineExt } from '@/features/reader/core/ext-types';
import { loadFoliateBook } from './book-loader';
import { FOLIATE_FORMATS } from './formats';
import type { FoliateReaderDocument } from './foliate-document';
import { openWith } from './open-with';

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
