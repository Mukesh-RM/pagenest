import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const outDir = resolve(root, 'docs/screens/voice-studio');
mkdirSync(outDir, { recursive: true });
const port = Number(process.env.PAGENEST_VOICE_STUDIO_PORT ?? 5310);
const url = `http://127.0.0.1:${port}/src/features/voice-studio/e2e/index.html`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url);
await page.getByRole('heading', { name: 'Voice Studio' }).waitFor();
await page.screenshot({ path: resolve(outDir, '01-my-voices-empty.png'), fullPage: true });

await page.getByRole('button', { name: 'Record my voice' }).click();
await page.getByRole('button', { name: 'I am ready' }).click();
await page.screenshot({ path: resolve(outDir, '02-consent-phrase.png'), fullPage: true });

await page.getByRole('button', { name: 'Start reading the phrase' }).click();
await page.getByRole('button', { name: 'Stop and verify' }).click();
await page.getByText('Phrase verified').waitFor();
await page.screenshot({ path: resolve(outDir, '03-consent-verified.png'), fullPage: true });

await browser.close();
