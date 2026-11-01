import { describe, expect, it } from 'vitest';
import { createSpeechEngine, parseSpeechVoiceUri, speechVoiceIdFrom } from '@/engines/tts/speech-engine';
import { phonemesToIds, runPiperInference } from '@/engines/tts/piper/inference';
import { encodeWav, concatSamples } from './wav-encode';
import { buildNarrationPlan } from '@/engines/emotion/pipeline';
import { OK_PIPER_VOICES } from '@/engines/tts/piper/voices';
import { readChapterText } from './chapter-text';

describe('wav encode', () => {
  it('writes a RIFF header', () => {
    const blob = encodeWav(new Float32Array([0, 0.5, -0.5]), 22050);
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBeGreaterThan(40);
  });

  it('concatenates chunks', () => {
    const merged = concatSamples(
      [
        { samples: new Float32Array([1, 2]), sampleRate: 22050 },
        { samples: new Float32Array([3]), sampleRate: 22050 },
      ],
      0,
    );
    expect(Array.from(merged)).toEqual([1, 2, 3]);
  });
});

describe('piper inference mock', () => {
  it('returns PCM without ONNX in test mode', async () => {
    const config = {
      audio: { sample_rate: 22050 },
      inference: { noise_scale: 1, length_scale: 1, noise_w: 1 },
      phoneme_id_map: { '^': [1], $: [2], h: [9] },
    };
    const result = await runPiperInference(undefined, phonemesToIds('h', config), config, 'Hello');
    expect(result.samples.length).toBeGreaterThan(100);
  });
});

describe('speech engine', () => {
  it('lists installed voices when speechSynthesis exists', async () => {
    const engine = createSpeechEngine();
    const voices = await engine.listVoices('en');
    expect(Array.isArray(voices)).toBe(true);
  });

  it('round-trips speech voice ids', () => {
    const id = speechVoiceIdFrom({
      name: 'Test',
      lang: 'en-US',
      voiceURI: 'com.example.voice',
      default: false,
      localService: true,
    } as SpeechSynthesisVoice);
    expect(parseSpeechVoiceUri(id)).toBe('com.example.voice');
  });
});

describe('narration plan length', () => {
  it('builds one entry per sentence', () => {
    expect(buildNarrationPlan('One. Two.').length).toBe(2);
  });
});

describe('chapter text', () => {
  it('reads foliate iframe body text', () => {
    const host = document.createElement('div');
    const iframe = document.createElement('iframe');
    host.appendChild(iframe);
    document.body.appendChild(host);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write('<body><p>Hello world.</p></body>');
    doc.close();
    const ref = { current: host };
    expect(readChapterText(ref)).toContain('Hello world');
    host.remove();
  });
});

describe('voice registry licence gate', () => {
  it('only registers audit-OK English voices (no lessac)', () => {
    for (const v of OK_PIPER_VOICES) {
      expect(v.id).not.toMatch(/lessac|ryan|libritts_r|orpheus/i);
    }
    expect(OK_PIPER_VOICES.some((v) => v.id === 'en_US-libritts-high')).toBe(true);
  });
});
