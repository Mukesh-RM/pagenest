import type { DataClient } from '@/data/data-client';

const REGISTRY_URL = '/packs/bergamot-registry.json';

type LatencyTranslator = {
  translate(req: { from: string; to: string; text: string; html?: boolean }): Promise<{ target: { text: string } }>;
  delete(): void;
};

let translatorPromise: Promise<LatencyTranslator> | undefined;

export async function translateWithBergamot(
  data: DataClient,
  from: string,
  to: string,
  text: string,
): Promise<string | undefined> {
  if (import.meta.env.MODE === 'test') return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const translator = await getLatencyTranslator(data);
  try {
    const { target } = await translator.translate({ from, to, text: trimmed, html: false });
    const out = target.text?.trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

async function getLatencyTranslator(data: DataClient): Promise<LatencyTranslator> {
  if (!translatorPromise) {
    translatorPromise = (async () => {
      const [{ LatencyOptimisedTranslator }, { OpfsTranslatorBacking }, workerMod] = await Promise.all([
        import('@browsermt/bergamot-translator/translator.js'),
        import('./opfs-backing'),
        import('@browsermt/bergamot-translator/worker/translator-worker.js?url'),
      ]);
      const backing = new OpfsTranslatorBacking(
        { registryUrl: REGISTRY_URL, downloadTimeout: 0, pivotLanguage: 'en' },
        data,
      );
      return new LatencyOptimisedTranslator(
        {
          registryUrl: REGISTRY_URL,
          workerUrl: workerMod.default,
          downloadTimeout: 0,
          pivotLanguage: 'en',
          cacheSize: 32,
        },
        backing,
      ) as LatencyTranslator;
    })();
  }
  return translatorPromise;
}
