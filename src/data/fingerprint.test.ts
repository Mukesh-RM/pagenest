// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { computeFingerprint, FINGERPRINT_SLICE_BYTES } from './fingerprint';

function bytes(size: number, fill = 1): Uint8Array<ArrayBuffer> {
  return new Uint8Array(size).fill(fill);
}

describe('computeFingerprint', () => {
  it('starts with the file size and is stable', async () => {
    const blob = new Blob([bytes(1000)]);
    const a = await computeFingerprint(blob);
    expect(a).toMatch(/^1000-[0-9a-f]{64}$/);
    expect(await computeFingerprint(new Blob([bytes(1000)]))).toBe(a);
  });

  it('matches a known SHA-256 for a small file', async () => {
    // sha256("abc") with an empty tail: head = "abc", tail = "" for files under one slice... and size prefix.
    const f = await computeFingerprint(new Blob(['abc']));
    expect(f).toBe('3-ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('changes when the size changes', async () => {
    expect(await computeFingerprint(new Blob([bytes(10)]))).not.toBe(await computeFingerprint(new Blob([bytes(11)])));
  });

  it('changes when the first or last megabyte changes, and ignores the middle', async () => {
    const size = FINGERPRINT_SLICE_BYTES * 3;
    const base = bytes(size);
    const reference = await computeFingerprint(new Blob([base]));

    const head = base.slice();
    head[10] = 9;
    expect(await computeFingerprint(new Blob([head]))).not.toBe(reference);

    const tail = base.slice();
    tail[size - 10] = 9;
    expect(await computeFingerprint(new Blob([tail]))).not.toBe(reference);

    const middle = base.slice();
    middle[FINGERPRINT_SLICE_BYTES + 100] = 9;
    expect(await computeFingerprint(new Blob([middle]))).toBe(reference);
  });

  it('handles an empty file and files between one and two slices', async () => {
    expect(await computeFingerprint(new Blob([]))).toMatch(/^0-[0-9a-f]{64}$/);
    const size = FINGERPRINT_SLICE_BYTES + 5;
    expect(await computeFingerprint(new Blob([bytes(size)]))).toMatch(new RegExp(`^${size}-[0-9a-f]{64}$`));
  });
});
