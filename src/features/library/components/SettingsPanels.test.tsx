import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeServices } from '@/app/test-utils';
import { ServicesContext, type AppServices } from '@/app/services-context';
import { bookRecord } from '@/data/test-fixtures';
import { makeEpub } from '@/workers/import/testing/fixtures';
import { getImportClient, resetImportController, setImportBackend } from '../registry';
import { inProcessBackend } from '../testing/in-process-backend';
import { BackupRestorePanel } from './BackupRestorePanel';
import { StoragePanel } from './StoragePanel';

// The two pieces the app wires into Settings: BackupRestorePanel and StoragePanel (src/app/components/
// LibrarySettingsPanels.tsx). Each is rendered here the
// way the app renders it, on the real import service and a real database, with only the browser's download
// and file picker stood in for.

let services: AppServices;
let backend: ReturnType<typeof inProcessBackend>;

beforeAll(() => {
  const proto = Blob.prototype as unknown as Record<string, unknown>;
  proto['arrayBuffer'] ??= function (this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
  proto['stream'] ??= function (this: Blob) {
    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        controller.enqueue(new Uint8Array(await (this as Blob).arrayBuffer()));
        controller.close();
      },
    });
  };
});
beforeEach(() => {
  services = makeServices('settings-panels');
  backend = inProcessBackend(services.db);
  resetImportController();
  setImportBackend(() => backend);
});
afterEach(async () => {
  vi.restoreAllMocks();
  resetImportController();
  services.covers.dispose();
  services.data.close();
  services.db.close();
  await services.db.delete();
});

const wrap = (node: JSX.Element) => (
  <ServicesContext.Provider value={services}>
    <MemoryRouter>{node}</MemoryRouter>
  </ServicesContext.Provider>
);

describe('Settings: Storage on this device', () => {
  it('lists what takes space by kind and says so when there is nothing to free', async () => {
    render(wrap(<StoragePanel />));
    const heading = screen.getByRole('heading', { name: 'Storage on this device' });
    const panel = heading.closest('section') as HTMLElement;
    for (const label of ['Books and documents', 'Audiobooks', 'Covers', 'Voices', 'Narrated chapters (can be made again)']) {
      expect(within(panel).getByText(label)).toBeTruthy();
    }
    await waitFor(() => expect(within(panel).queryAllByText('…')).toHaveLength(0)); // every row has its size
    expect((within(panel).getByRole('button', { name: 'Free up space' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('counts a stored book under Books and documents', async () => {
    await backend.files.write('books/b1/original', new Blob([new Uint8Array(2048)]));
    await services.db.books.put(bookRecord('b1', { title: 'Stored', fingerprint: 'fp' }));
    render(wrap(<StoragePanel />));
    const row = (await screen.findByText('Books and documents')).parentElement as HTMLElement;
    await waitFor(() => expect(row.querySelector('dd')?.textContent).not.toBe('…'));
  });
});

describe('Settings: Backup and restore', () => {
  it('saves a backup to a file the person downloads, then restores it into a library that is empty again', async () => {
    const saved: Blob[] = [];
    const clicks: string[] = [];
    // jsdom has no object URLs: stand in for the download.
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      saved.push(blob as Blob);
      return 'blob:backup';
    };
    URL.revokeObjectURL = () => undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    // A real book through the real importer, so the backup holds a stored file, not just a row.
    const epub = await makeEpub({ title: 'Round Trip', author: 'A. Writer' });
    const file = new File([epub as BlobPart], 'rt.epub', { type: 'application/epub+zip' });
    await getImportClient().run({ type: 'import', items: [{ file }] }).done;
    expect(await services.db.books.count()).toBeGreaterThan(0);

    render(wrap(<BackupRestorePanel />));
    fireEvent.click(screen.getByRole('button', { name: 'Save a backup' }));
    expect(await screen.findByText(/Backup saved/)).toBeTruthy();
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toMatch(/^PageNest backup \d{4}-\d{2}-\d{2}\.zip$/);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.size).toBeGreaterThan(1000);

    // Everything is removed, then restored from that file.
    await services.db.books.clear();
    await services.db.progress.clear();
    const input = screen.getByTestId('restore-file') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File([saved[0] as Blob], 'backup.zip')] });
    fireEvent.change(input);
    expect(await screen.findByText(/Restored 1 book/)).toBeTruthy();
    expect(await services.db.books.count()).toBe(1);
    expect((await services.db.books.toArray())[0]?.title).toBe('Round Trip');
  });

  it('refuses a file that is not a backup, in plain words', async () => {
    render(wrap(<BackupRestorePanel />));
    const input = screen.getByTestId('restore-file') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File([new Uint8Array(300)], 'photo.zip')] });
    fireEvent.change(input);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/not look like a PageNest backup|not a PageNest backup|damaged/);
    expect((screen.getByRole('button', { name: 'Save a backup' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
