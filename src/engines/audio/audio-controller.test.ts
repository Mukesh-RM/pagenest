import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioController } from './audio-controller';
import { audioItemFromSingleFile } from './build-item';
import { DexieProgressService } from '@/data/progress-service';
import { getDb } from '@/data/db';
import { createMockAudioElement } from './test/mock-audio';

describe('createAudioController', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads, plays, reports progress, and pauses', async () => {
    const audio = createMockAudioElement();
    const db = getDb();
    const progress = new DexieProgressService(db, { intervalMs: 60_000 });
    const controller = createAudioController({ audio, progress });

    const blob = new Blob(['fake'], { type: 'audio/wav' });
    const item = audioItemFromSingleFile('book-1', 'Test book', async () => blob, 60, [
      { index: 0, title: 'Start', startSec: 0 },
      { index: 1, title: 'Later', startSec: 30 },
    ]);

    await controller.load(item);
    expect(controller.getState().status).toBe('ready');

    await controller.play();
    expect(controller.getState().status).toBe('playing');

    (audio as ReturnType<typeof createMockAudioElement> & { _tick: (n: number) => void })._tick(5);
    expect(controller.getState().positionSec).toBeGreaterThan(0);

    controller.pause();
    expect(controller.getState().status).toBe('paused');

    const saved = await progress.get('book-1', 'listen');
    expect(saved?.locator.kind).toBe('audio');
  });

  it('clamps speed and preserves pitch flag', () => {
    const audio = createMockAudioElement();
    const progress = new DexieProgressService(getDb(), { intervalMs: 60_000 });
    const controller = createAudioController({ audio, progress });
    controller.setSpeed(9);
    expect(controller.getState().speed).toBe(3);
    controller.setSpeed(0.1);
    expect(controller.getState().speed).toBe(0.5);
    expect((audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch).toBe(true);
  });

  it('sleep timer pauses at end of chapter', async () => {
    const audio = createMockAudioElement();
    const progress = new DexieProgressService(getDb(), { intervalMs: 60_000 });
    const controller = createAudioController({ audio, progress });
    const item = audioItemFromSingleFile('b2', 'Sleep', async () => new Blob(['x']), 120, [
      { index: 0, title: 'A', startSec: 0 },
      { index: 1, title: 'B', startSec: 10 },
    ]);
    await controller.load(item, { kind: 'audio', trackIndex: 0, positionSec: 5 });
    controller.setSleepTimer({ kind: 'endOfChapter' });
    await controller.play();
    (audio as ReturnType<typeof createMockAudioElement> & { _tick: (n: number) => void })._tick(6);
    expect(controller.getState().status).toBe('paused');
  });
});
