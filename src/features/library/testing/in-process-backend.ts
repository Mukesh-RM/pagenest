import type { PageNestDB } from '@/data/db';
import type { FileStore } from '@/data/opfs';
import { inProcessImportBackend } from '../in-process-import';
import type { ImportBackend } from '../import-client';

/** @deprecated Use {@link inProcessImportBackend} from `../in-process-import`. */
export function inProcessBackend(db: PageNestDB, files?: FileStore): ImportBackend & { files: FileStore } {
  return inProcessImportBackend(db, files);
}
