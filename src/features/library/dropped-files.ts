import type { ImportItem } from '@/workers/import/protocol';

/** A folder entry as the browser's drag and drop API describes it (webkitGetAsEntry). */
interface FsEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath?: string;
  file?(ok: (file: File) => void, fail: (error: unknown) => void): void;
  createReader?(): { readEntries(ok: (entries: FsEntry[]) => void, fail: (error: unknown) => void): void };
}

async function readAll(entry: FsEntry): Promise<FsEntry[]> {
  const reader = entry.createReader?.();
  if (!reader) return [];
  const out: FsEntry[] = [];
  for (;;) {
    const batch = await new Promise<FsEntry[]>((ok, fail) => reader.readEntries(ok, fail));
    if (batch.length === 0) return out;
    out.push(...batch); // readEntries returns at most ~100 at a time; keep asking until empty
  }
}

async function walk(entry: FsEntry, prefix: string, out: ImportItem[]): Promise<void> {
  if (entry.isFile && entry.file) {
    const f = entry.file.bind(entry);
    const file = await new Promise<File>((ok, fail) => f(ok, fail)).catch(() => undefined);
    if (file) out.push(prefix === '' ? { file } : { file, relPath: `${prefix}${entry.name}` });
  } else if (entry.isDirectory) {
    for (const child of await readAll(entry)) await walk(child, `${prefix}${entry.name}/`, out);
  }
}

/** True when a drag carries files (not text or a link), so the drop overlay only shows for files. */
export function dragHasFiles(dt: Pick<DataTransfer, 'types'> | null): boolean {
  return !!dt && Array.from(dt.types).includes('Files');
}

/** Every file in a drop, folders included. Falls back to the plain file list in browsers without folder support. */
export async function collectDropped(dt: DataTransfer): Promise<ImportItem[]> {
  const items = Array.from(dt.items ?? []);
  const entries = items
    .filter((i) => i.kind === 'file')
    .map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry?.() ?? null);
  if (entries.length > 0 && entries.every((e) => e !== null)) {
    const out: ImportItem[] = [];
    for (const entry of entries as FsEntry[]) await walk(entry, '', out);
    return out;
  }
  return Array.from(dt.files ?? []).map((file) => ({ file }));
}

/** Files from a picker. A folder pick carries each file's path inside the folder. */
export function itemsFromPicker(files: FileList | null): ImportItem[] {
  if (!files) return [];
  return Array.from(files).map((file) => {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    return rel ? { file, relPath: rel } : { file };
  });
}
