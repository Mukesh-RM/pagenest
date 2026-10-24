import type { DataService } from './data-service';
import type { MethodPath } from './rpc';

/**
 * Names of every {@link DataService} method, for building the RPC client. Kept apart from
 * `data-service.ts` (only the *type* is imported) so the main thread can know the names without
 * pulling the service, the repositories and the search index into the first-load bundle.
 */
export const DATA_SERVICE_METHODS = [
  'fileStoreInfo',
  'writeFile',
  'openFile',
  'fileExists',
  'fileSize',
  'removeFile',
  'listFiles',
  'fileUsage',
  'fingerprint',
  'stats',
  'books.get',
  'books.getMany',
  'books.findByFingerprint',
  'books.count',
  'books.getTracks',
  'books.getChapters',
  'books.add',
  'books.update',
  'books.markOpened',
  'books.setChapters',
  'books.setCover',
  'books.removeCover',
  'books.getCover',
  'books.trash',
  'books.restore',
  'books.purge',
  'books.purgeAll',
  'books.remove',
  'books.cleanupOrphans',
  'collections.list',
  'collections.get',
  'collections.create',
  'collections.rename',
  'collections.remove',
  'collections.reorder',
  'collections.addBooks',
  'collections.removeBooks',
  'collections.reorderBooks',
  'collections.booksIn',
  'collections.shelvesOf',
  'library.query',
  'library.count',
] as const satisfies readonly MethodPath<DataService>[];
