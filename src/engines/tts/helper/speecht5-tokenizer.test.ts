import { describe, expect, it } from 'vitest';
import { loadSpeechT5Tokenizer } from './speecht5-tokenizer';

describe('speecht5 tokenizer', () => {
  it('encodes text with metaspace and eos', () => {
    const json = new TextEncoder().encode(
      JSON.stringify({
        model: {
          vocab: { '<pad>': 1, '</s>': 2, '<unk>': 3, '\u2581': 4, H: 30, i: 10 },
        },
      }),
    );
    const tok = loadSpeechT5Tokenizer(json.buffer);
    const ids = tok.encode('Hi');
    expect(ids[0]).toBe(4);
    expect(ids[1]).toBe(30);
    expect(ids[2]).toBe(10);
    expect(ids[ids.length - 1]).toBe(2);
  });
});
