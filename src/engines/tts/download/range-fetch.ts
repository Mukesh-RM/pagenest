export interface RangeFetchProgress {
  readonly receivedBytes: number;
  readonly totalBytes: number | undefined;
}

export interface RangeFetchOptions {
  readonly url: string;
  readonly startByte: number;
  readonly signal?: AbortSignal;
  readonly etag?: string;
  readonly onProgress?: (progress: RangeFetchProgress) => void;
}

export interface RangeFetchResult {
  readonly bytes: Uint8Array;
  readonly etag: string | undefined;
  readonly complete: boolean;
}

/**
 * Resumable download via HTTP Range. Validates ETag when resuming.
 * `url` must be absolute; callers inject approved CDN URLs at runtime.
 */
export async function fetchRange(options: RangeFetchOptions): Promise<RangeFetchResult> {
  const headers: Record<string, string> = {};
  if (options.startByte > 0) {
    headers.Range = `bytes=${options.startByte}-`;
    if (options.etag) {
      headers['If-Range'] = options.etag;
    }
  }

  const response = await fetch(options.url, { headers, signal: options.signal });
  if (options.startByte > 0 && response.status === 416) {
    throw new Error('Download could not resume; try again from the start.');
  }
  if (!response.ok && response.status !== 206 && response.status !== 200) {
    throw new Error(`Download failed (${response.status}).`);
  }

  const etag = response.headers.get('etag') ?? options.etag ?? undefined;
  if (
    options.startByte > 0 &&
    options.etag &&
    response.headers.get('etag') &&
    response.headers.get('etag') !== options.etag
  ) {
    throw new Error('The voice file changed on the server; download again from the start.');
  }

  const contentLength = response.headers.get('content-length');
  const chunkLength = contentLength ? parseInt(contentLength, 10) : undefined;
  const reader = response.body?.getReader();
  if (!reader) {
    const buf = new Uint8Array(await response.arrayBuffer());
    options.onProgress?.({
      receivedBytes: options.startByte + buf.length,
      totalBytes: undefined,
    });
    return { bytes: buf, etag, complete: response.status === 200 && options.startByte === 0 };
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      options.onProgress?.({
        receivedBytes: options.startByte + received,
        totalBytes: chunkLength !== undefined ? options.startByte + chunkLength : undefined,
      });
    }
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  const complete =
    response.status === 200 && options.startByte === 0
      ? true
      : chunkLength !== undefined && received >= chunkLength;
  return { bytes: merged, etag, complete };
}

export async function fetchContentLength(url: string, signal?: AbortSignal): Promise<number | undefined> {
  const head = await fetch(url, { method: 'HEAD', signal });
  if (!head.ok) {
    return undefined;
  }
  const len = head.headers.get('content-length');
  return len ? parseInt(len, 10) : undefined;
}
