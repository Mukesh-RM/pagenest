import { decodeWavMono } from './wav-decode';

const N_FFT = 512;
const HOP = 256;

/** Lightweight timbre colorization: replace STFT magnitudes with a blend of source and reference. */
export function colorizeWithReference(source: Float32Array, reference: Float32Array, mix = 0.55): Float32Array {
  if (!reference.length) return source;
  const ref = reference.length > 16_000 ? reference.subarray(0, 16_000) : reference;
  const magRef = averageMagnitudeSpectrum(ref);
  const frames = Math.max(1, Math.floor((source.length - N_FFT) / HOP));
  const out = new Float32Array(source.length);
  const window = hann(N_FFT);
  for (let f = 0; f < frames; f += 1) {
    const start = f * HOP;
    const frame = new Float32Array(N_FFT);
    for (let i = 0; i < N_FFT; i += 1) {
      const s = source[start + i] ?? 0;
      frame[i] = s * window[i]!;
    }
    const spec = rfft(frame);
    for (let k = 0; k < spec.length; k += 2) {
      const re = spec[k]!;
      const im = spec[k + 1]!;
      const mag = Math.hypot(re, im);
      const phase = Math.atan2(im, re);
      const refMag = magRef[k / 2] ?? mag;
      const blended = mag * (1 - mix) + refMag * mix;
      spec[k] = blended * Math.cos(phase);
      spec[k + 1] = blended * Math.sin(phase);
    }
    const time = irfft(spec);
    for (let i = 0; i < N_FFT; i += 1) {
      const idx = start + i;
      if (idx < out.length) out[idx] = (out[idx] ?? 0) + (time[i] ?? 0) * (window[i] ?? 0);
    }
  }
  let peak = 0;
  for (let i = 0; i < out.length; i += 1) peak = Math.max(peak, Math.abs(out[i]!));
  if (peak > 1) for (let i = 0; i < out.length; i += 1) out[i] = (out[i] ?? 0) / peak;
  return out;
}

export async function buildReferencePcm(wavSources: readonly (Blob | ArrayBuffer)[]): Promise<Float32Array> {
  const chunks: Float32Array[] = [];
  for (const source of wavSources) {
    chunks.push(await decodeWavMono(source instanceof ArrayBuffer ? source : source, 22_050));
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(Math.min(total, 220_500));
  let o = 0;
  for (const c of chunks) {
    const take = Math.min(c.length, out.length - o);
    out.set(c.subarray(0, take), o);
    o += take;
    if (o >= out.length) break;
  }
  return out;
}

function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i += 1) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}

function averageMagnitudeSpectrum(pcm: Float32Array): Float32Array {
  const bins = N_FFT / 2 + 1;
  const acc = new Float32Array(bins);
  let count = 0;
  for (let start = 0; start + N_FFT < pcm.length; start += HOP) {
    const frame = pcm.subarray(start, start + N_FFT);
    const spec = rfft(frame);
    for (let b = 0; b < bins; b += 1) {
      const re = spec[b * 2]!;
      const im = spec[b * 2 + 1]!;
      acc[b] = (acc[b] ?? 0) + Math.hypot(re, im);
    }
    count += 1;
  }
  if (count > 0) for (let b = 0; b < bins; b += 1) acc[b] = (acc[b] ?? 0) / count;
  return acc;
}

function rfft(time: Float32Array): Float32Array {
  const n = time.length;
  const out = new Float32Array(n * 2);
  for (let k = 0; k <= n / 2; k += 1) {
    let re = 0;
    let im = 0;
    for (let t = 0; t < n; t += 1) {
      const ang = (-2 * Math.PI * k * t) / n;
      re += time[t]! * Math.cos(ang);
      im += time[t]! * Math.sin(ang);
    }
    out[k * 2] = re;
    out[k * 2 + 1] = im;
  }
  return out;
}

function irfft(spec: Float32Array): Float32Array {
  const n = spec.length / 2;
  const out = new Float32Array(n);
  for (let t = 0; t < n; t += 1) {
    let sum = 0;
    for (let k = 0; k <= n / 2; k += 1) {
      const re = spec[k * 2]!;
      const im = spec[k * 2 + 1]!;
      const ang = (2 * Math.PI * k * t) / n;
      sum += re * Math.cos(ang) - im * Math.sin(ang);
    }
    out[t] = sum / n;
  }
  return out;
}
