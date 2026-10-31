#!/usr/bin/env node
/**
 * Synthesizes a large scan-style PDF for the 50 MB open-time test (not committed). Text from alice.txt (Gutenberg #11, PD).
 * Each page: noisy grey JPEG plus a text layer. Node-only (pdf-lib + jpeg-js).
 *
 * Usage: node make-large-pdf.mjs <out.pdf> [targetMegabytes=50]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import jpeg from 'jpeg-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const out = process.argv[2];
const targetMb = Number(process.argv[3] ?? 50);
if (!out) {
  console.error('Usage: node make-large-pdf.mjs <out.pdf> [targetMegabytes=50]');
  process.exit(1);
}

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = readFileSync(join(fixtures, 'alice.txt'), 'utf8');
const body = raw.split('*** START OF THE PROJECT GUTENBERG EBOOK', 1)[1]?.split('\n', 1)[1] ?? raw;
const words = body.split(/\s+/).filter(Boolean);

const w = 1240;
const h = 1754;
const pageW = 595.28;
const pageH = 841.89;

function scanJpeg() {
  const data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) {
    const base = 232 + (i % 97) / 20;
    data[i] = Math.min(255, Math.max(0, Math.round(base + (randomBytes(1)[0] % 50) - 25)));
  }
  return jpeg.encode({ data, width: w, height: h }, 85).data;
}

const pdfDoc = await PDFDocument.create();
pdfDoc.setTitle('PageNest large PDF fixture');
pdfDoc.setAuthor('PageNest fixtures (generated)');
const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

let cursor = 0;
let pages = 0;
let bytes = 0;

while (bytes < targetMb * 1024 * 1024) {
  const page = pdfDoc.addPage([pageW, pageH]);
  const jpg = scanJpeg();
  const image = await pdfDoc.embedJpg(jpg);
  page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH });
  let y = pageH - 60;
  for (let line = 0; line < 46; line++) {
    const chunk = words.slice(cursor, cursor + 11).join(' ');
    cursor = (cursor + 11) % Math.max(1, words.length - 12);
    page.drawText(chunk, { x: 60, y, size: 11, font, color: rgb(0, 0, 0) });
    y -= 15;
  }
  page.drawText(String(pages + 1), { x: pageW / 2 - 6, y: 30, size: 10, font, color: rgb(0, 0, 0) });
  pages += 1;
  if (pages % 3 === 0 || pages === 1) {
    bytes = (await pdfDoc.save({ useObjectStreams: false })).length;
  }
}

const final = await pdfDoc.save({ useObjectStreams: false });
writeFileSync(out, final);
console.log(`${out} pages=${pages} size=${(final.length / 1e6).toFixed(1)} MB`);
