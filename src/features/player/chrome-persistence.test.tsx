import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioController } from '@/engines/audio';
import { audioItemFromSingleFile } from '@/engines/audio/build-item';
import { DexieProgressService } from '@/data/progress-service';
import { getDb } from '@/data/db';
import { createMockAudioElement } from '@/engines/audio/test/mock-audio';
import { snapshotFromState } from './playback-snapshot';
import { selectIsPlaying, usePlayerStore } from './audio-store';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chrome unmount safety', () => {
  it('keeps controller state when the mini-player would unmount on an immersive route', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: () => undefined,
    });
    const audio = createMockAudioElement();
    const progress = new DexieProgressService(getDb(), { intervalMs: 60_000 });
    const controller = createAudioController({ audio, progress });
    const item = audioItemFromSingleFile('b1', 'Persist', async () => new Blob(['x']), 60, [
      { index: 0, title: 'A', startSec: 0 },
    ]);
    await controller.load(item);
    controller.setSpeed(2);
    controller.setSleepTimer({ kind: 'endOfChapter' });
    controller.goToChapter(0);
    await controller.play();
    usePlayerStore.getState().setState(controller.getState());
    const before = snapshotFromState(controller.getState(), selectIsPlaying());
    // Simulate mini-player unmount: controller is not torn down.
    expect(before.isPlaying).toBe(true);
    expect(before.speed).toBe(2);
    expect(before.sleepEndOfChapter).toBe(true);
    expect(before.chapterIndex).toBe(0);
    controller.pause();
    const after = snapshotFromState(controller.getState(), selectIsPlaying());
    expect(after.speed).toBe(2);
    expect(after.sleepEndOfChapter).toBe(true);
  });
});
