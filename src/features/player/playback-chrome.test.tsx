import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockAudioElement } from '@/engines/audio/test/mock-audio';
import { audioItemFromSingleFile } from '@/engines/audio/build-item';

vi.mock('@/engines/audio', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createAudioElement: () => createMockAudioElement(),
  };
});
import { DexieProgressService } from '@/data/progress-service';
import { getDb } from '@/data/db';
import { ServicesProvider } from '@/app/services';
import { createDataClient } from '@/data/data-client';
import { FullPlayerView } from './FullPlayerView';
import { AudioMiniPlayer } from './AudioMiniPlayer';
import { PlayerProvider, getAudioController, resetAudioForTests } from './PlayerProvider';
import { snapshotFromState, snapshotsEqual } from './playback-snapshot';
import { usePlayerStore } from './audio-store';

afterEach(() => {
  vi.unstubAllGlobals();
  resetAudioForTests();
});

function makeServices() {
  const db = getDb();
  return {
    db,
    progress: new DexieProgressService(db, { intervalMs: 60_000 }),
    data: createDataClient({ db, workerFactory: () => undefined }),
  };
}

function syncStoreFromController(): void {
  const controller = getAudioController();
  if (!controller) return;
  const s = controller.getState();
  usePlayerStore.getState().setState(s);
}

describe('playback survives chrome unmount', () => {
  it('keeps isPlaying, position, speed, sleep timer and chapter across mini-player unmount and remount', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: () => undefined,
    });
    const services = makeServices();
    let showMini = true;

    const ui = (mini: boolean) => (
      <MemoryRouter>
        <ServicesProvider services={services}>
          <PlayerProvider>{mini ? <AudioMiniPlayer /> : <FullPlayerView />}</PlayerProvider>
        </ServicesProvider>
      </MemoryRouter>
    );

    const { rerender } = render(ui(showMini));

    const controller = getAudioController()!;
    const item = audioItemFromSingleFile('b1', 'Persist', async () => new Blob(['x']), 120, [
      { index: 0, title: 'Chapter A', startSec: 0 },
      { index: 1, title: 'Chapter B', startSec: 60 },
    ]);
    await controller.load(item, { kind: 'audio', trackIndex: 0, positionSec: 12 });
    controller.setSpeed(1.5);
    controller.setSleepTimer({ kind: 'minutes', minutes: 30 });
    await controller.play();
    controller.seekTo(16);
    await waitFor(() => expect(controller.getState().status).toBe('playing'));
    syncStoreFromController();

    await waitFor(() => expect(screen.getByRole('region', { name: 'Mini player' })).toBeInTheDocument());
    const playing = controller.getState().status === 'playing';
    const before = snapshotFromState(controller.getState(), playing);
    expect(before.speed).toBe(1.5);
    expect(before.sleepMinutes).toBe(30);
    expect(before.isPlaying).toBe(true);

    showMini = false;
    rerender(ui(showMini));
    await waitFor(() => expect(screen.getByRole('heading', { name: /now playing/i })).toBeInTheDocument());
    const immersive = snapshotFromState(controller.getState(), controller.getState().status === 'playing');
    expect(snapshotsEqual(before, immersive)).toBe(true);

    showMini = true;
    rerender(ui(showMini));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Mini player' })).toBeInTheDocument());
    syncStoreFromController();
    const remounted = snapshotFromState(controller.getState(), controller.getState().status === 'playing');
    expect(snapshotsEqual(immersive, remounted)).toBe(true);
    expect(remounted.speed).toBe(1.5);
    expect(remounted.sleepMinutes).toBe(30);
    expect(remounted.chapterIndex).toBe(before.chapterIndex);
  });
});
