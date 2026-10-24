// @vitest-environment node
import http from 'node:http';
import { afterAll, describe, expect, it } from 'vitest';
import { fetchContentLength, fetchRange } from './range-fetch';

const payload = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
const etag = '"v1"';

const server = http.createServer((req, res) => {
  if (req.method === 'HEAD') {
    res.writeHead(200, { 'Content-Length': String(payload.length), ETag: etag });
    res.end();
    return;
  }
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d+)-/.exec(range);
    const start = m?.[1] ? parseInt(m[1], 10) : 0;
    const chunk = payload.slice(start);
    res.writeHead(206, {
      'Content-Length': String(chunk.length),
      'Content-Range': `bytes ${start}-${start + chunk.length - 1}/${payload.length}`,
      ETag: etag,
    });
    res.end(chunk);
    return;
  }
  res.writeHead(200, { 'Content-Length': String(payload.length), ETag: etag });
  res.end(payload);
});

await new Promise<void>((resolve) => server.listen(0, resolve));
const port = (server.address() as { port: number }).port;
const base = `http://127.0.0.1:${port}/voice.onnx`;

afterAll(() => {
  server.close();
});

describe('fetchRange', () => {
  it('reads content length via HEAD', async () => {
    const len = await fetchContentLength(base);
    expect(len).toBe(payload.length);
  });

  it('resumes with Range', async () => {
    const first = await fetchRange({ url: base, startByte: 0 });
    expect(first.bytes.length).toBe(payload.length);
    const second = await fetchRange({ url: base, startByte: 5, etag: first.etag });
    expect([...second.bytes]).toEqual([5, 6, 7, 8, 9]);
  });
});
