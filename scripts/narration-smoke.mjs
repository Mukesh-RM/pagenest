#!/usr/bin/env node
/**
 * MANUAL-RUN narration smoke (not part of default npm test).
 * Prerequisites: tests/manual/narration/README.md
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelOnnx = path.join(root, '.models/narration/en_US-amy-low/en_US-amy-low.onnx');

if (!existsSync(modelOnnx)) {
  console.error(
    'Voice model not found. Download per tests/manual/narration/README.md into .models/narration/',
  );
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

await run('npx', ['vite', 'build', '-c', 'tests/manual/narration/vite.smoke.config.ts']);
await run('npx', ['playwright', 'test', '-c', 'tests/manual/narration/playwright.config.mjs']);
