import { FOLIATE_FORMATS } from '@/engines/epub/formats';
import { ReaderRegistry } from './core/registry';

/**
 * The reader's engines. Each one is loaded the first time a book of one of its formats opens, so the app shell stays
 * small. Routing is by stored format (`books.format`, detected from the file's bytes by the Library): never from a file
 * name, extension or MIME type. A new format is a new entry here; the reader screen never changes.
 */
export function createDefaultRegistry(): ReaderRegistry {
  return new ReaderRegistry().register({
    id: 'foliate',
    formats: FOLIATE_FORMATS,
    load: async () => new (await import('@/engines/epub/epub-engine')).FoliateEngine(),
  });
}
