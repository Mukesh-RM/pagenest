/**
 * Duplicate-detection fingerprint (blueprint section 6): file size plus a SHA-256 of the first
 * and last megabyte. Reads at most 2 MB however large the file is, so a 2 GB audiobook is as fast
 * as a small PDF. Hashing is still real work, so call it from a worker (`DataClient.fingerprint`).
 */
export const FINGERPRINT_SLICE_BYTES = 1024 * 1024;

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** `"<size>-<sha256 of head and tail>"`. Same bytes always give the same string; any size or edge change gives another. */
export async function computeFingerprint(file: Blob, subtle: SubtleCrypto = crypto.subtle): Promise<string> {
  const headEnd = Math.min(file.size, FINGERPRINT_SLICE_BYTES);
  const tailStart = Math.max(headEnd, file.size - FINGERPRINT_SLICE_BYTES);
  const [head, tail] = await Promise.all([file.slice(0, headEnd).arrayBuffer(), file.slice(tailStart).arrayBuffer()]);
  const joined = new Uint8Array(head.byteLength + tail.byteLength);
  joined.set(new Uint8Array(head), 0);
  joined.set(new Uint8Array(tail), head.byteLength);
  return `${file.size}-${hex(await subtle.digest('SHA-256', joined))}`;
}
