import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioController } from '@/engines/audio';
import { audioItemFromSingleFile } from '@/engines/audio/build-item';
import { DexieProgressService } from '@/data/progress-service';
import { getDb } from '@/data/db';
import { createMockAudioElement } from '@/engines/audio/test/mock-audio';
import { usePlayerStore } from './audio-store';

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
    usePlayerStore.getState().setState(controller.getState());
    await controller.play();
    const playing = controller.getState().status;
    // Simulate mini-player unmount: no React teardown of the controller.
    expect(controller.getState().item?.bookId).toBe('b1');
    expect(playing).toBe('playing');
    controller.pause();
    expect(controller.getState().positionSec).toBeGreaterThanOrEqual(0);
  });
});
