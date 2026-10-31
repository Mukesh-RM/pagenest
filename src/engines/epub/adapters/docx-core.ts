import mammoth from 'mammoth';

/** mammoth.js conversion, free of DOM and worker plumbing so it runs in a worker or inline. */

export interface DocxResult {
  readonly html: string;
  readonly messages: readonly string[];
}

export async function convertDocxInline(buffer: ArrayBuffer): Promise<DocxResult> {
  const result = await mammoth.convertToHtml(
    // mammoth accepts Node `Buffer` or `Uint8Array`; its typings only list `Buffer`.
    { buffer: new Uint8Array(buffer) } as { buffer: Buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.readAsBase64String()}`,
      })),
    },
  );
  return { html: result.value, messages: result.messages.map((m) => m.message) };
}

