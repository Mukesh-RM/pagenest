import { describe, expect, it } from 'vitest';
import { textToPhonemeString } from './g2p/text-to-phonemes';
import { phonemesToIds } from './inference';

describe('piper g2p', () => {
  it('looks up CMUdict words', () => {
    const phones = textToPhonemeString('Hello world.');
    expect(phones.length).toBeGreaterThan(3);
  });

  it('maps phonemes to ids with boundaries', () => {
    const config = { audio: { sample_rate: 22050 }, inference: { noise_scale: 1, length_scale: 1, noise_w: 1 }, phoneme_id_map: { '^': [1], $: [2], h: [9], e: [10] } };
    const ids = phonemesToIds('he', config);
    expect(ids[0]).toBe(1);
    expect(ids.at(-1)).toBe(2);
  });
});
