import { describe, expect, it } from 'vitest';
import { openWordnetPack } from './wnpk';

describe('wnpk lookup speed', () => {
  it('binary search returns a gloss under 1 ms for a small pack', () => {
    // minimal valid pack with one entry "hello"
    const enc = new TextEncoder();
    const word = enc.encode('hello');
    const data = enc.encode('n\na greeting');
    const index = new Uint8Array([word.length, ...word, 0, 0, 0, 0, 0, data.length & 255]);
    const header = new ArrayBuffer(32);
    const h = new DataView(header);
    h.setUint32(0, 0x4b504e57, true);
    h.setUint16(4, 1, true);
    h.setUint32(8, 1, true);
    h.setUint32(12, 32, true);
    h.setUint32(16, 32 + index.length, true);
    h.setUint32(20, index.length, true);
    h.setUint32(24, data.length, true);
    const buf = new Uint8Array(32 + index.length + data.length);
    buf.set(new Uint8Array(header), 0);
    buf.set(index, 32);
    buf.set(data, 32 + index.length);
    const idx = openWordnetPack(buf.buffer);
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) idx.define('hello');
    const per = (performance.now() - t0) / 500;
    expect(idx.define('hello').senses[0]?.glosses[0]).toContain('greeting');
    expect(per).toBeLessThan(1);
  });
});
