/** jsdom's Blob has no stream() or arrayBuffer(); the import code needs both. Call once in a test file. */
export function polyfillBlob(): void {
  const proto = Blob.prototype as unknown as Record<string, unknown>;
  proto['arrayBuffer'] ??= function (this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
  proto['stream'] ??= function (this: Blob) {
    return streamOf(this);
  };
}

function streamOf(blob: Blob): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
      controller.close();
    },
  });
}
