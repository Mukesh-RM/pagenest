import '../library.css';
import { useRef, useState } from 'react';
import { Button, ProgressBar } from '@/ui';
import type { RestoreSummary } from '@/workers/import/protocol';
import { getImportClient } from '../registry';

type Status = { kind: 'idle' } | { kind: 'busy'; label: string; value: number } | { kind: 'done'; message: string } | { kind: 'error'; message: string };

interface PickerWindow {
  showSaveFilePicker?: (options: { suggestedName: string; types?: { description: string; accept: Record<string, string[]> }[] }) => Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Save everything (books, progress, notes, shelves, settings) into one file, or restore from one. Settings screen. */
export function BackupRestorePanel() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const input = useRef<HTMLInputElement>(null);
  const busy = status.kind === 'busy';

  async function save(): Promise<void> {
    const win = window as unknown as PickerWindow;
    const name = `InkQuiet backup ${new Date().toISOString().slice(0, 10)}.zip`;
    let handle: Awaited<ReturnType<NonNullable<PickerWindow['showSaveFilePicker']>>> | undefined;
    if (win.showSaveFilePicker) {
      // Ask where to save first: the picker needs the tap that started this, and a big backup takes a while.
      try {
        handle = await win.showSaveFilePicker({ suggestedName: name, types: [{ description: 'InkQuiet backup', accept: { 'application/zip': ['.zip'] } }] });
      } catch {
        return; // the person closed the picker
      }
    }
    setStatus({ kind: 'busy', label: 'Saving your library', value: 0 });
    try {
      const job = getImportClient().run<{ blob: Blob; fileName: string }>({ type: 'backup' }, (e) => {
        if (e.type === 'progress') setStatus({ kind: 'busy', label: e.stage, value: e.total > 0 ? e.done / e.total : 0 });
      });
      const { blob, fileName } = await job.done;
      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setStatus({ kind: 'done', message: 'Backup saved. Keep it somewhere safe; it holds your whole library.' });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error && error.message ? error.message : 'The backup could not be saved. Please try again.' });
    }
  }

  async function restore(file: File): Promise<void> {
    setStatus({ kind: 'busy', label: 'Restoring', value: 0 });
    try {
      const job = getImportClient().run<RestoreSummary>({ type: 'restore', file }, (e) => {
        if (e.type === 'progress') setStatus({ kind: 'busy', label: e.stage, value: e.total > 0 ? e.done / e.total : 0 });
      });
      const r = await job.done;
      setStatus({
        kind: 'done',
        message: `Restored ${plural(r.booksAdded, 'book', 'books')}${r.booksAlreadyThere > 0 ? `. ${plural(r.booksAlreadyThere, 'book was', 'books were')} already here and kept as they are` : ''}.`,
      });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error && error.message ? error.message : 'The backup could not be restored. Please try again.' });
    }
  }

  return (
    <section className="pn-lib-panel" aria-labelledby="pn-backup-title">
      <h2 id="pn-backup-title">Backup and restore</h2>
      <p>Your library lives only on this device. A backup is one file with your books, progress, notes and collections. Restoring never replaces books you already have.</p>
      <div className="pn-lib-sheet-actions">
        <Button block icon="download" disabled={busy} onClick={() => void save()}>
          Save a backup
        </Button>
        <Button block variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
          Restore from a backup
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        data-testid="restore-file"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (file) void restore(file);
        }}
      />
      <div role="status" aria-live="polite" className="pn-lib-backup-status">
        {status.kind === 'busy' ? (
          <>
            <span>{status.label}</span>
            <ProgressBar value={status.value} label={status.label} />
          </>
        ) : null}
        {status.kind === 'done' ? <span>{status.message}</span> : null}
      </div>
      {status.kind === 'error' ? (
        <p role="alert" className="pn-lib-error">
          {status.message}
        </p>
      ) : null}
    </section>
  );
}
