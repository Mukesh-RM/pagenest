import { readerError } from '@/features/reader/core/errors';
import type { DocxResult } from './docx-core';

export type { DocxResult };

/** Convert a DOCX to HTML with mammoth.js. Runs in a worker where workers exist, so the page never freezes. */

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

/** Password-protected Office files are OLE containers, not zip files. */
export async function checkDocx(file: Blob): Promise<void> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (OLE_MAGIC.every((b, i) => head[i] === b)) throw readerError('drm');
  if (!ZIP_MAGIC.every((b, i) => head[i] === b)) throw readerError('corrupt');
}

export async function convertDocx(file: Blob): Promise<DocxResult> {
  await checkDocx(file);
  const inline = async (): Promise<DocxResult> =>
    (await import('./docx-core')).convertDocxInline(await file.arrayBuffer());
  if (typeof Worker === 'undefined') return inline();
  const worker = new Worker(new URL('./docx.worker.ts', import.meta.url), { type: 'module' });
  const buffer = await file.arrayBuffer();
  try {
    return await new Promise<DocxResult>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<{ ok: true; result: DocxResult } | { ok: false }>): void => {
        if (event.data.ok) resolve(event.data.result);
        else reject(new Error('docx worker conversion failed'));
      };
      worker.onerror = (): void => reject(new Error('docx worker failed'));
      worker.postMessage(buffer.slice(0), [buffer.slice(0)]);
    }).catch(() => inline());
  } finally {
    worker.terminate();
  }
}
