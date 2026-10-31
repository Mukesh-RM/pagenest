import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SnackbarProvider } from '@/ui';
import { createMockAudioElement } from '@/engines/audio/test/mock-audio';
import { audioItemFromSingleFile } from '@/engines/audio/build-item';
import { DexieProgressService } from '@/data/progress-service';
import { getDb } from '@/data/db';
import { ServicesProvider } from '@/app/services';
import { CoverUrlCache } from '@/data/cover-url';
import { createDataClient } from '@/data/data-client';
import type { BookRecord } from '@/data/schema';
import { IntegratedPlayerView } from './integrated-player-view';
import { PlayerProvider, getAudioController, resetAudioForTests } from './PlayerProvider';
import { useChromePlayerStore } from './chrome-store';
import { usePlayerStore } from './audio-store';
import { chromeSnapshotFromAudioState } from './sync-chrome-from-engine';
import { MemoryRouter } from 'react-router-dom';
import { loadAudioSkipOptions, persistSkipInterval } from './skip-settings';

vi.mock('@/engines/audio', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    createAudioElement: () => createMockAudioElement(),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetAudioForTests();
});

function makeServices() {
  const db = getDb();
  const data = createDataClient({ db, workerFactory: () => undefined });
  return {
    db,
    progress: new DexieProgressService(db, { intervalMs: 60_000 }),
    data,
    covers: new CoverUrlCache({ load: (id) => data.books.getCover(id) }),
  };
}

function syncStoreFromController(): void {
  const controller = getAudioController();
  if (!controller) return;
  const s = controller.getState();
  usePlayerStore.getState().setState(s);
  const snap = chromeSnapshotFromAudioState(s);
  useChromePlayerStore.getState().setChrome(snap.chrome, snap.sessionActive);
}

const book: BookRecord = {
  id: 'b1',
  fingerprint: 'fp',
  kind: 'audio',
  format: 'mp3',
  title: 'Bookmarks',
  addedAt: Date.now(),
  favorite: false,
  finished: false,
};

function renderPlayer(services: ReturnType<typeof makeServices>) {
  return render(
    <MemoryRouter>
      <ServicesProvider services={services}>
        <SnackbarProvider>
          <PlayerProvider>
            <IntegratedPlayerView book={book} />
          </PlayerProvider>
        </SnackbarProvider>
      </ServicesProvider>
    </MemoryRouter>,
  );
}

describe('useAudioPlayerController wiring', () => {
  it('adds and undoes a bookmark from the player chip', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: () => undefined,
    });
    const services = makeServices();
    renderPlayer(services);

    const controller = getAudioController()!;
    const item = audioItemFromSingleFile('b1', 'Bookmarks', async () => new Blob(['x']), 200, [
      { index: 0, title: 'Ch 1', startSec: 0 },
    ]);
    await controller.load(item, { kind: 'audio', trackIndex: 0, positionSec: 42 });
    syncStoreFromController();

    await waitFor(() => expect(screen.getByRole('region', { name: 'Audio player' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Add bookmark at/i }));

    const snackbar = await screen.findByRole('button', { name: 'Undo' });
    expect(snackbar.closest('[data-pn-snackbar-viewport]')).toHaveTextContent(/Bookmark added at 0:42/i);
    const rows = await services.db.bookmarks.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.locator).toEqual({ kind: 'audio', trackIndex: 0, positionSec: 42 });

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => {
      expect(await services.db.bookmarks.toArray()).toHaveLength(0);
    });
  }, 15_000);

  it('persists skip interval from the player menu', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: () => undefined,
    });
    const services = makeServices();
    await persistSkipInterval(services.db, 'back', 30);
    renderPlayer(services);

    const controller = getAudioController()!;
    const item = audioItemFromSingleFile('b1', 'Bookmarks', async () => new Blob(['x']), 120, [
      { index: 0, title: 'Ch 1', startSec: 0 },
    ]);
    await controller.load(item, { kind: 'audio', trackIndex: 0, positionSec: 0 });
    syncStoreFromController();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Back 30 seconds' })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: 'More options' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Skip buttons' }));
    const backGroup = screen.getByLabelText('Back, seconds');
    await userEvent.click(within(backGroup).getByRole('radio', { name: '60 seconds' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Back 60 seconds' })).toBeInTheDocument());
    await expect(loadAudioSkipOptions(services.db)).resolves.toMatchObject({ skipBackSec: 60 });
  });
});
