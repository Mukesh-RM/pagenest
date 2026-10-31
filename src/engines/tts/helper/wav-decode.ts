/** Decode mono PCM from a WAV blob or raw buffer (16-bit PCM or 32-bit float). */
export async function decodeWavMono(source: Blob | ArrayBuffer, targetRate = 16_000): Promise<Float32Array> {
  const buf =
    source instanceof ArrayBuffer
      ? source
      : typeof source.arrayBuffer === 'function'
        ? await source.arrayBuffer()
        : await new Response(source).arrayBuffer();
  const view = new DataView(buf);
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') {
    throw new Error('Not a WAV file.');
  }
  let offset = 12;
  let audioFormat = 1;
  let channels = 1;
  let sampleRate = 16_000;
  let bitsPerSample = 16;
  let dataOffset = 0;
  let dataLen = 0;
  while (offset + 8 <= view.byteLength) {
    const id = readAscii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (id === 'fmt ') {
      audioFormat = view.getUint16(chunkStart, true);
      channels = view.getUint16(chunkStart + 2, true);
      sampleRate = view.getUint32(chunkStart + 4, true);
      bitsPerSample = view.getUint16(chunkStart + 14, true);
    } else if (id === 'data') {
      dataOffset = chunkStart;
      dataLen = size;
      break;
    }
    offset = chunkStart + size + (size % 2);
  }
  if (!dataLen) throw new Error('WAV has no data chunk.');
  const samples = decodePcm(view, dataOffset, dataLen, audioFormat, bitsPerSample, channels);
  if (sampleRate === targetRate) return samples;
  return resampleLinear(samples, sampleRate, targetRate);
}

function readAscii(view: DataView, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

function decodePcm(
  view: DataView,
  offset: number,
  byteLen: number,
  audioFormat: number,
  bits: number,
  channels: number,
): Float32Array {
  const frameCount = Math.floor(byteLen / (bits / 8) / channels);
  const out = new Float32Array(frameCount);
  let o = 0;
  for (let i = 0; i < frameCount; i += 1) {
    let sum = 0;
    for (let c = 0; c < channels; c += 1) {
      const idx = offset + (i * channels + c) * (bits / 8);
      if (audioFormat === 3 && bits === 32) sum += view.getFloat32(idx, true);
      else if (bits === 16) sum += view.getInt16(idx, true) / 32768;
      else sum += (view.getUint8(idx) - 128) / 128;
    }
    out[o++] = sum / channels;
  }
  return out;
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const outLen = Math.max(1, Math.floor((input.length * toRate) / fromRate));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    const src = (i * fromRate) / toRate;
    const lo = Math.floor(src);
    const hi = Math.min(input.length - 1, lo + 1);
    const t = src - lo;
    out[i] = (input[lo] ?? 0) * (1 - t) + (input[hi] ?? 0) * t;
  }
  return out;
}
