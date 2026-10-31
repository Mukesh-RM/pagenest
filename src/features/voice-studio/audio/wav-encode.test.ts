import { describe, expect, it } from 'vitest';
import { readBlobBytes } from '../data/blob-read';
import { encodeWavMono } from './wav-encode';

describe('encodeWavMono', () => {
  it('writes a RIFF header and 16-bit PCM payload', async () => {
    const samples = new Float32Array([0, 0.5, -0.5]);
    const blob = encodeWavMono(samples, 16_000);
    expect(blob.type).toBe('audio/wav');
    const buf = await readBlobBytes(blob);
    expect(String.fromCharCode(...buf.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...buf.slice(8, 12))).toBe('WAVE');
    expect(buf.length).toBeGreaterThan(44);
  });
});
