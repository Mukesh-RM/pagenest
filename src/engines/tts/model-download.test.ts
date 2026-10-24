// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { transitionModelDownload, type ModelDownloadState } from './model-download';

const manifest = {
  engine: 'piper' as const,
  voiceId: 'en-test',
  displayName: 'Test',
  language: 'en',
  totalBytes: 1000,
  files: [{ relativePath: 'model.onnx', sizeBytes: 1000, sha256: 'abc' }],
  integrity: { algorithm: 'sha256' as const, files: { 'model.onnx': 'abc' } },
};

function idle(): ModelDownloadState {
  return { phase: 'idle', engine: 'piper', voiceId: 'en-test', manifest };
}

describe('transitionModelDownload', () => {
  it('moves through consent and install', () => {
    let state = idle();
    state = transitionModelDownload(state, { type: 'request-download' });
    expect(state.phase).toBe('checking-quota');
    state = transitionModelDownload(state, { type: 'quota-known', freeBytes: 5000 });
    expect(state.phase).toBe('awaiting-user-consent');
    state = transitionModelDownload(state, { type: 'user-confirmed' });
    expect(state.phase).toBe('downloading');
    state = transitionModelDownload(state, {
      type: 'progress',
      progress: { done: 500, total: 1000 },
      receivedBytes: 500,
    });
    state = transitionModelDownload(state, { type: 'verify-started' });
    expect(state.phase).toBe('verifying');
    state = transitionModelDownload(state, {
      type: 'verify-succeeded',
      installedAt: 1,
    });
    expect(state.phase).toBe('installed');
  });

  it('fails when quota is too small', () => {
    let state = transitionModelDownload(idle(), { type: 'request-download' });
    state = transitionModelDownload(state, { type: 'quota-known', freeBytes: 10 });
    expect(state.phase).toBe('failed');
    if (state.phase === 'failed') {
      expect(state.code).toBe('quota-exceeded');
    }
  });
});
