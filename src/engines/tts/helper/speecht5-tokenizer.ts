/** Minimal SpeechT5 (Xenova) text encoder from downloaded tokenizer.json — no transformers.js. */

export interface SpeechT5Tokenizer {
  encode(text: string): Int32Array;
}

export function loadSpeechT5Tokenizer(tokenizerJson: ArrayBuffer): SpeechT5Tokenizer {
  const raw = JSON.parse(new TextDecoder().decode(tokenizerJson)) as {
    model?: { vocab?: Record<string, number>; unk_id?: number };
  };
  const vocab = raw.model?.vocab ?? {};
  const unk = vocab['<unk>'] ?? raw.model?.unk_id ?? 3;
  const eos = vocab['</s>'] ?? 2;

  return {
    encode(text: string): Int32Array {
      const trimmed = text.trim();
      if (!trimmed) return new Int32Array([eos]);
      const metaspace = `\u2581${trimmed.replace(/\s+/g, '\u2581')}`;
      const ids: number[] = [];
      for (const ch of metaspace) {
        ids.push(vocab[ch] ?? unk);
      }
      ids.push(eos);
      return new Int32Array(ids);
    },
  };
}
