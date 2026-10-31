import { describe, expect, it } from 'vitest';
import { createCloneRuntime } from './clone-runtime';
import { miniWavMono } from './test-mini-wav';

describe('clone runtime', () => {
  it('builds profile and synthesizes colored mock speech', async () => {
    const rt = createCloneRuntime();
    const wav = miniWavMono();
    const profile = await rt.prepareProfile({
      voiceId: 'v1',
      wavBuffers: [wav.buffer, wav.buffer],
      allowDownload: true,
    });
    expect(profile.embedding.length).toBe(512);
    expect(profile.referencePcm.length).toBeGreaterThan(100);
    const out = await rt.synthesize({
      text: 'Hello from my voice.',
      embedding: profile.embedding,
      referencePcm: profile.referencePcm,
      tier: 'lite',
      rate: 1,
      stackReady: false,
    });
    expect(out.samples.length).toBeGreaterThan(500);
    expect(out.durationSec).toBeGreaterThan(0.2);
  });
});
