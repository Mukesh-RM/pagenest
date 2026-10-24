/** mammoth.js conversion, free of DOM and worker plumbing so it runs in a worker or inline. */

export interface DocxResult {
  readonly html: string;
  readonly messages: readonly string[];
}

export async function convertDocxInline(buffer: ArrayBuffer): Promise<DocxResult> {
  const mammoth = (await import('mammoth')).default ?? (await import('mammoth'));
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.readAsBase64String()}`,
      })),
    },
  );
  return { html: result.value, messages: result.messages.map((m) => m.message) };
}

