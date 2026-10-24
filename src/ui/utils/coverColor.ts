import type { Rgb } from './color';

/**
 * Dominant color of an RGBA pixel buffer (a downscaled cover). Pixels are bucketed into a coarse
 * 4-bit-per-channel histogram, buckets are weighted by saturation so a colorful cover wins over its
 * gray border, and near-white and near-black pixels are ignored. Returns undefined for an empty or
 * fully transparent buffer. Pure and cheap: it touches at most a few hundred pixels.
 */
export function dominantColor(pixels: ArrayLike<number>): Rgb | undefined {
  const buckets = new Map<number, { w: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const a = pixels[i + 3]!;
    if (a < 128) continue;
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 24 || min > 232) continue;
    const saturation = max === 0 ? 0 : (max - min) / max;
    const weight = 0.15 + saturation;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { w: 0, r: 0, g: 0, b: 0 };
    bucket.w += weight;
    bucket.r += r * weight;
    bucket.g += g * weight;
    bucket.b += b * weight;
    buckets.set(key, bucket);
  }
  let best: { w: number; r: number; g: number; b: number } | undefined;
  for (const bucket of buckets.values()) if (!best || bucket.w > best.w) best = bucket;
  if (!best) return undefined;
  return [Math.round(best.r / best.w), Math.round(best.g / best.w), Math.round(best.b / best.w)];
}

const SAMPLE_SIZE = 24;
const memo = new Map<string, Promise<Rgb | undefined>>();

/** Forget memoized results (tests). */
export function clearCoverColorCache(): void {
  memo.clear();
}

async function loadBitmap(src: string): Promise<ImageBitmap | HTMLImageElement | undefined> {
  if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      // Decoded and resized off the main thread by the browser.
      return await createImageBitmap(blob, { resizeWidth: SAMPLE_SIZE, resizeHeight: SAMPLE_SIZE, resizeQuality: 'low' });
    } catch {
      /* fall through to the image element */
    }
  }
  if (typeof Image === 'undefined') return undefined;
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(undefined);
    image.src = src;
  });
}

/**
 * Cheap, memoized cover color extraction: decode the cover at 24 x 24 (off the main thread through
 * createImageBitmap, or a small image element), draw it on an OffscreenCanvas (or a tiny canvas), and
 * pick the dominant color. Never throws; resolves undefined when the cover cannot be read.
 */
export function extractCoverColor(src: string): Promise<Rgb | undefined> {
  const cached = memo.get(src);
  if (cached) return cached;
  const job = (async (): Promise<Rgb | undefined> => {
    const bitmap = await loadBitmap(src);
    if (!bitmap) return undefined;
    try {
      let context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
      if (typeof OffscreenCanvas !== 'undefined') {
        context = new OffscreenCanvas(SAMPLE_SIZE, SAMPLE_SIZE).getContext('2d');
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        context = canvas.getContext('2d', { willReadFrequently: true });
      }
      if (!context) return undefined;
      context.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      return dominantColor(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
    } catch {
      return undefined;
    } finally {
      if ('close' in bitmap) bitmap.close();
    }
  })();
  memo.set(src, job);
  return job;
}
