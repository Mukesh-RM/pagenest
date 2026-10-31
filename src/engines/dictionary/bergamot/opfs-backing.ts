import { TranslatorBacking } from '@browsermt/bergamot-translator/translator.js';
import type { DataClient } from '@/data/data-client';
import { readBergamotModelFile } from './model-store';

/** Bergamot backing that reads model blobs from OPFS (pre-downloaded in Settings). */
export class OpfsTranslatorBacking extends TranslatorBacking {
  readonly #data: DataClient;

  constructor(options: ConstructorParameters<typeof TranslatorBacking>[0], data: DataClient) {
    super(options);
    this.#data = data;
  }

  override async fetch(
    url: string,
    checksum: string | null | undefined,
    extra?: RequestInit & { signal?: AbortSignal },
  ): Promise<ArrayBuffer> {
    const cached = await readBergamotModelFile(this.#data, url);
    if (cached) {
      if (checksum) {
        const digest = await crypto.subtle.digest('SHA-256', cached);
        const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
        if (hex !== checksum.toLowerCase()) {
          throw new Error(`Checksum mismatch for cached model ${url}`);
        }
      }
      return cached;
    }
    return super.fetch(url, checksum, extra);
  }
}
