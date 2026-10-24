import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const smokeVoiceId = 'en_US-ljspeech-medium';
const modelDir = path.resolve(here, `../../../.models/narration/${smokeVoiceId}`);
const distDir = path.resolve(here, 'dist');
const ortWasmDir = path.resolve(here, '../../../node_modules/onnxruntime-web/dist');

test.describe.configure({ mode: 'serial' });

test('MANUAL-RUN Piper browser smoke', async ({ page }) => {
  const modelPath = path.join(modelDir, `${smokeVoiceId}.onnx`);
  const configPath = path.join(modelDir, `${smokeVoiceId}.onnx.json`);
  let modelBytes: Buffer;
  let configBytes: Buffer;
  try {
    modelBytes = await readFile(modelPath);
    configBytes = await readFile(configPath);
  } catch {
    test.skip(true, `Model missing. See tests/manual/narration/README.md`);
    return;
  }

  const harnessJs = await readFile(path.join(distDir, 'smoke-harness.js'), 'utf8');
  const dictMini = 'HELLO HH AH0 L OW1\nFROM F R AH1 M\nPAGENEST P EY1 JH AH0 N EH1 S T\n';

  const server = createServer(async (req, res) => {
    const url = req.url ?? '/';
    if (url === '/model.onnx') {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(modelBytes);
      return;
    }
    if (url === '/model.onnx.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(configBytes);
      return;
    }
    if (url.startsWith('/ort/')) {
      const rel = decodeURIComponent(url.slice('/ort/'.length));
      const file = path.normalize(path.join(ortWasmDir, rel));
      if (!file.startsWith(ortWasmDir)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await readFile(file);
      const type = file.endsWith('.mjs')
        ? 'text/javascript'
        : file.endsWith('.wasm')
          ? 'application/wasm'
          : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
      return;
    }
    if (url === '/harness.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(harnessJs);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><html><body><script type="module" src="/harness.js"></script></body></html>`);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  await page.goto(base);
  const result = await page.evaluate(
    async ({ baseUrl, dictText }) => {
      await new Promise((r) => setTimeout(r, 100));
      return window.runNarrationSmoke({
        modelUrl: `${baseUrl}/model.onnx`,
        configUrl: `${baseUrl}/model.onnx.json`,
        dictText,
        wasmBaseUrl: `${baseUrl}/ort/`,
      });
    },
    { baseUrl: base, dictText: dictMini },
  );

  server.close();

  expect(result.finite).toBe(true);
  expect(result.peak).toBeGreaterThan(0.01);
  expect(result.rtf).toBeLessThan(5);
  console.info('NARRATION_SMOKE', JSON.stringify(result));
});
