import { describe, expect, it, vi } from 'vitest';
import { createAudioElement } from '@/engines/audio';
import type { ProgressService } from '@/app/contracts';
import { createDeferredAudioController } from './deferred-audio-controller';

const progress = {
  report: vi.fn(),
  save: vi.fn(),
  flush: vi.fn(),
  get: vi.fn(),
  getLatest: vi.fn(),
  subscribe: vi.fn(() => () => undefined),
} as ProgressService;

describe('createDeferredAudioController', () => {
  it('does not create an audio element until load or play', () => {
    const callsBefore = vi.mocked(createAudioElement).mock.calls.length;
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
