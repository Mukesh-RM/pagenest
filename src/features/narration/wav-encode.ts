/** Encode mono PCM samples as a 16-bit WAV blob (played through the shared audio element). */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

/** Merge sentence buffers with short silence gaps (milliseconds). */
export function concatSamples(chunks: readonly { samples: Float32Array; sampleRate: number }[], gapMs = 120): Float32Array {
  if (chunks.length === 0) return new Float32Array(0);
  const rate = chunks[0]!.sampleRate;
  const gap = Math.floor((rate * gapMs) / 1000);
  const total =
    chunks.reduce((n, c) => n + c.samples.length, 0) + gap * Math.max(0, chunks.length - 1);
  const out = new Float32Array(total);
  let off = 0;
  chunks.forEach((c, i) => {
    out.set(c.samples, off);
    off += c.samples.length;
    if (i < chunks.length - 1) off += gap;
  });
  return out;
}

export function renderAudioPath(bookId: string, chapterIndex: number, voiceId: string, style: string): string {
  return `renders/${bookId}/${chapterIndex}-${voiceId}-${style}.wav`;
}
