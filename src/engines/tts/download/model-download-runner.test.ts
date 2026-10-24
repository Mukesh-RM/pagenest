// @vitest-environment node
import crypto from 'node:crypto';
import http from 'node:http';
import { afterAll, describe, expect, it } from 'vitest';
import type { VoiceModelManifest } from '../model-download';
import { createMemoryVoiceStorage } from './memory-voice-storage';
import { ModelDownloadRunner } from './model-download-runner';

const fileBytes = new TextEncoder().encode('piper-model-bytes-for-test');
const digest = crypto.createHash('sha256').update(fileBytes).digest('hex');

const server = http.createServer((req, res) => {
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d+)-/.exec(range);
    const start = m?.[1] ? parseInt(m[1], 10) : 0;
    const chunk = fileBytes.slice(start);
    res.writeHead(206, {
      'Content-Length': String(chunk.length),
      ETag: '"m1"',
    });
    res.end(chunk);
    return;
  }
  if (req.method === 'HEAD') {
    res.writeHead(200, { 'Content-Length': String(fileBytes.length), ETag: '"m1"' });
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Length': String(fileBytes.length), ETag: '"m1"' });
  res.end(fileBytes);
});

await new Promise<void>((resolve) => server.listen(0, resolve));
const port = (server.address() as { port: number }).port;
const baseUrl = `http://127.0.0.1:${port}`;

afterAll(() => server.close());

const manifest: VoiceModelManifest = {
  engine: 'piper',
  voiceId: 'test-en',
  displayName: 'Test',
  language: 'en',
  totalBytes: fileBytes.length,
  files: [{ relativePath: 'model.onnx', sizeBytes: fileBytes.length, sha256: digest }],
  integrity: { algorithm: 'sha256', files: { 'model.onnx': digest } },
};

describe('ModelDownloadRunner', () => {
  it('downloads, verifies, and installs', async () => {
    const storage = createMemoryVoiceStorage();
    const runner = new ModelDownloadRunner({ storage, manifest, baseUrl });
    const final = await runner.start();
    expect(final.phase).toBe('installed');
    const stored = await storage.files.read('voices/piper/test-en/model.onnx');
    expect(new TextDecoder().decode(stored)).toBe('piper-model-bytes-for-test');
  });

  it('deletes installed files', async () => {
    const storage = createMemoryVoiceStorage();
    const runner = new ModelDownloadRunner({ storage, manifest, baseUrl });
    await runner.start();
    const deleted = await runner.deleteInstalled();
    expect(deleted.phase).toBe('idle');
    expect(await storage.files.exists('voices/piper/test-en/model.onnx')).toBe(false);
  });
});
