import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { once } from 'node:events';

/**
 * Writes a valid PDF of about `megabytes` MB to `path` without holding it in memory: a catalog, a page tree of
 * `pages` pages, an Info dictionary with a title and author, and one page-1 image XObject whose data is
 * `megabytes` MB of incompressible bytes (a big scan, in effect). The cross-reference table is classic and at the
 * end of the file, as most producers write it, with exact byte offsets, so any PDF reader opens it.
 * Returns the size in bytes.
 */
export async function writeBigPdf(path: string, megabytes: number, o: { title: string; author: string; pages?: number }): Promise<number> {
  const pages = o.pages ?? 120;
  const imageBytes = megabytes * 1024 * 1024;
  const side = Math.ceil(Math.sqrt(imageBytes));
  const length = side * Math.floor(imageBytes / side); // Width x Height of an 8-bit gray image
  const height = length / side;
  const imageNum = 3 + pages + 1; // after the pages and the Info dictionary
  const infoNum = 3 + pages;

  const head = Buffer.from('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n', 'latin1');
  const offsets: number[] = [];
  let position = head.length;
  const small: string[] = [];
  const add = (num: number, body: string): void => {
    offsets[num - 1] = position;
    const text = `${num} 0 obj\n${body}\nendobj\n`;
    small.push(text);
    position += Buffer.byteLength(text, 'latin1');
  };
  add(1, '<< /Type /Catalog /Pages 2 0 R >>');
  add(2, `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${3 + i} 0 R`).join(' ')}] /Count ${pages} >>`);
  for (let i = 0; i < pages; i += 1) add(3 + i, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]${i === 0 ? ` /Resources << /XObject << /Scan ${imageNum} 0 R >> >>` : ''} >>`);
  add(infoNum, `<< /Title (${o.title}) /Author (${o.author}) /Producer (PageNest acceptance test) >>`);

  const imageHead = `${imageNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${side} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${length} >>\nstream\n`;
  offsets[imageNum - 1] = position;
  position += Buffer.byteLength(imageHead, 'latin1') + length;
  const imageTail = '\nendstream\nendobj\n';
  position += Buffer.byteLength(imageTail, 'latin1');
  const total = imageNum;
  const xrefAt = position;
  const xref = `xref\n0 ${total + 1}\n0000000000 65535 f \n${offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${total + 1} /Root 1 0 R /Info ${infoNum} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  const out = createWriteStream(path);
  const write = async (chunk: Buffer): Promise<void> => {
    if (!out.write(chunk)) await once(out, 'drain');
  };
  await write(head);
  await write(Buffer.from(small.join(''), 'latin1'));
  await write(Buffer.from(imageHead, 'latin1'));
  const block = randomBytes(1024 * 1024);
  let left = length;
  while (left > 0) {
    const take = Math.min(left, block.length);
    // Rotate the block a little each time so the file does not repeat every MB.
    block[0] = (block[0]! + 1) & 255;
    await write(take === block.length ? block : block.subarray(0, take));
    left -= take;
  }
  await write(Buffer.from(imageTail + xref, 'latin1'));
  out.end();
  await once(out, 'finish');
  return xrefAt + Buffer.byteLength(xref, 'latin1');
}
