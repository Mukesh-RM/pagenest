import { describe, expect, it, vi } from 'vitest';
import { createAudioElement } from '@/engines/audio';
import { DexieProgressService } from '@/data/progress-service';
import { getDb } from '@/data/db';
import { createDeferredAudioController } from './deferred-audio-controller';

describe('createDeferredAudioController', () => {
  it('does not create an audio element until load or play', () => {
    const callsBefore = vi.mocked(createAudioElement).mock.calls.length;
    const progress = new DexieProgressService(getDb(), { intervalMs: 60_000 });
    const controller = createDeferredAudioController(progress);
    expect(controller.getState().status).toBe('idle');
    expect(vi.mocked(createAudioElement).mock.calls.length).toBe(callsBefore);
    void controller.load({
      bookId: 'b1',
      title: 'T',
      tracks: [{ index: 0, title: 't', durationSec: 1, startOffsetSec: 0, open: async () => new Blob([]) }],
      chapters: [],
    });
    expect(vi.mocked(createAudioElement).mock.calls.length).toBe(callsBefore + 1);
  });
});
