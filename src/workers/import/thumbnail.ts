/**
 * Shrink a cover to card size inside a worker (OffscreenCanvas), so grids of 1000 covers stay light.
 * Returns `undefined` when the browser cannot decode or draw it, and the original bytes are kept.
 */
export const THUMB_MAX_WIDTH = 360;
export const THUMB_MAX_HEIGHT = 540;
const KEEP_AS_IS_BYTES = 40 * 1024;

export async function makeThumbnail(bytes: Uint8Array): Promise<Uint8Array | undefined> {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return undefined;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
    const scale = Math.min(1, THUMB_MAX_WIDTH / bitmap.width, THUMB_MAX_HEIGHT / bitmap.height);
    if (scale === 1 && bytes.length <= KEEP_AS_IS_BYTES) return undefined;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    context.drawImage(bitmap, 0, 0, width, height);
    let blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
    if (blob.type !== 'image/webp') blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.84 });
    const out = new Uint8Array(await blob.arrayBuffer());
    return out.length < bytes.length || scale < 1 ? out : undefined;
  } catch {
    return undefined;
  } finally {
    bitmap?.close();
  }
}
