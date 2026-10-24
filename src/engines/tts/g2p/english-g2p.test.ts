// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseCmudict } from './cmu-dict';
import { englishTextToPhonemeIds } from './english-g2p';
import type { PiperVoiceConfig } from '../piper/piper-voice-config';

const dict = parseCmudict(`HELLO HH AH0 L OW1\nWORLD W ER1 L D`);

const config: PiperVoiceConfig = {
  audio: { sample_rate: 22050 },
  inference: { noise_scale: 0.333, length_scale: 1, noise_w: 0.333 },
  phoneme_type: 'espeak',
  phoneme_id_map: {
    _: [0],
    '^': [1],
    $: [2],
    ' ': [3],
    h: [20],
    ə: [59],
    l: [24],
    o: [27],
    ʊ: [100],
    ˈ: [120],
    w: [35],
    ɚ: [60],
    d: [17],
    ɹ: [88],
  },
  num_symbols: 256,
  num_speakers: 1,
};

describe('englishTextToPhonemeIds', () => {
  it('encodes dictionary hits', () => {
    const result = englishTextToPhonemeIds('hello world', { dict, voiceConfig: config });
    expect(result.dictHits).toBe(2);
    expect(result.dictMisses).toBe(0);
    expect(result.phonemeIds.length).toBeGreaterThan(4);
    expect(result.unknownSymbols).toHaveLength(0);
  });

  it('spell-fallback marks OOV words', () => {
    const result = englishTextToPhonemeIds('xyzzy', { dict, voiceConfig: config });
    expect(result.oovWords).toContain('xyzzy');
    expect(result.dictMisses).toBe(1);
  });
});
