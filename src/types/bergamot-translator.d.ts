declare module '@browsermt/bergamot-translator/translator.js' {
  export class TranslatorBacking {
    constructor(options?: Record<string, unknown>);
    registryUrl: string;
    fetch(url: string, checksum?: string | null, extra?: RequestInit & { signal?: AbortSignal }): Promise<ArrayBuffer>;
  }

  export class LatencyOptimisedTranslator {
    constructor(options?: Record<string, unknown>, backing?: TranslatorBacking);
    translate(req: {
      from: string;
      to: string;
      text: string;
      html?: boolean;
    }): Promise<{ target: { text: string } }>;
    delete(): void;
  }
}

declare module '@browsermt/bergamot-translator/worker/translator-worker.js?url' {
  const src: string;
  export default src;
}
