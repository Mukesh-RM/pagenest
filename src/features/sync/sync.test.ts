import { describe, expect, it } from 'vitest';
import { parseEncrypted, serializeEncrypted } from '@/workers/sync/crypto';
import { chunkEncryptedForQr, QrReassembler } from './qr/frames';

describe('QR sync frames', () => {
  it('round-trips encrypted JSON through chunked frames', () => {
    const encrypted = {
      format: 'pagenest-sync-encrypted' as const,
      version: 1 as const,
      salt: 'abc=',
      iv: 'def=',
      data: 'x'.repeat(2500),
    };
    const { frames, total } = chunkEncryptedForQr(encrypted);
    expect(total).toBeGreaterThan(1);
    const reasm = new QrReassembler();
    let out;
    for (const frame of frames) {
      out = reasm.push(frame);
    }
    expect(out).toEqual(parseEncrypted(serializeEncrypted(encrypted)));
  });
});
