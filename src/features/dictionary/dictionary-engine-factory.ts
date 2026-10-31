import type { DataClient } from '@/data/data-client';
import { FilePaths } from '@/data/opfs';
import type { DictionaryPackMeta, PackProgress } from '@/engines/dictionary/types';
import { dictionaryError } from '@/engines/dictionary/errors';
import { loadLexiconPack, translateWithLexicon, type LexiconPackJson } from '@/engines/dictionary/bergamot/lexicon-translate';
import { TRANSLATION_PACKS, translationPackById } from '@/engines/dictionary/bergamot/catalog';
import { DEFINITION_PACKS, WORDNET_EN_CORE } from '@/engines/dictionary/wordnet/catalog';
import { loadWordnetPack, lookupWordnet, normalizeWord } from '@/engines/dictionary/wordnet/lexicon';
import type { DefinitionSense } from '@/engines/dictionary/types';
import type { DefinitionResult, DictionaryEngine, TranslationResult } from '@/engines/dictionary/types';

function isMockPackMode(): boolean {
  try {
    return import.meta.env.VITE_PN_MOCK_DICTIONARY === '1' || import.meta.env.MODE === 'test';
  } catch {
    return false;
  }
}

/** Embedded mini packs for unit tests (not shipped in production bundles). */
export async function testDefinitionBytes(): Promise<ArrayBuffer> {
  const mod = await import('@/features/dictionary/fixtures/wordnet-en-mini.json?raw');
  return new TextEncoder().encode(mod.default).buffer;
}

export async function testTranslationBytes(pair: string): Promise<ArrayBuffer | undefined> {
  if (pair === 'translate-en-hi') {
    const mod = await import('@/features/dictionary/fixtures/translate-en-hi-mini.json?raw');
    return new TextEncoder().encode(mod.default).buffer;
  }
  return undefined;
}

async function downloadPack(
  meta: DictionaryPackMeta,
  options?: { signal?: AbortSignal; onProgress?: (p: PackProgress) => void },
): Promise<ArrayBuffer> {
  const res = await fetch(meta.url, { signal: options?.signal });
  if (!res.ok) throw dictionaryError('download-failed', `Could not download ${meta.name}.`);
  const total = Number(res.headers.get('content-length') || meta.sizeBytes);
  const reader = res.body?.getReader();
  if (!reader) return res.arrayBuffer();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    options?.onProgress?.({ received, total });
  }
  const out = new Uint8Array(received);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out.buffer;
}

export function createDictionaryEngine(deps: {
  readonly data: DataClient;
  readonly defaultTranslationPair?: string;
}): DictionaryEngine {
  let definitionMap: Map<string, DefinitionSense[]> | undefined;
  const lexicons = new Map<string, LexiconPackJson>();
  const defaultPair = deps.defaultTranslationPair ?? 'translate-en-hi';

  const readPack = async (packId: string): Promise<ArrayBuffer | undefined> => {
    const path = FilePaths.dictionaryPack(packId);
    try {
      return await (await deps.data.openFile(path)).arrayBuffer();
    } catch {
      return undefined;
    }
  };

  const writePack = async (packId: string, data: ArrayBuffer): Promise<void> => {
    await deps.data.writeFile(FilePaths.dictionaryPack(packId), data);
  };

  const loadDefinitions = async (bytes: ArrayBuffer): Promise<void> => {
    definitionMap = loadWordnetPack(bytes);
  };

  const hydrate = async (): Promise<void> => {
    if (!definitionMap) {
      const bytes = await readPack(WORDNET_EN_CORE.id);
      if (bytes) await loadDefinitions(bytes);
    }
    for (const meta of TRANSLATION_PACKS) {
      if (lexicons.has(meta.id)) continue;
      const bytes = await readPack(meta.id);
      if (bytes) lexicons.set(meta.id, loadLexiconPack(bytes));
    }
  };

  return {
    id: 'offline-dictionary',
    hydrate,
    isReady: () => Boolean(definitionMap),
    listDefinitionPacks: () => DEFINITION_PACKS,
    listTranslationPacks: () => TRANSLATION_PACKS,
    isTranslationReady: (pairId) => lexicons.has(pairId),
    async ensureDefinitionsPack(options) {
      if (definitionMap) return;
      let bytes = await readPack(WORDNET_EN_CORE.id);
      if (!bytes && isMockPackMode()) bytes = await testDefinitionBytes();
      if (!bytes) {
        bytes = await downloadPack(WORDNET_EN_CORE, options);
        await writePack(WORDNET_EN_CORE.id, bytes);
      }
      await loadDefinitions(bytes);
    },
    define(word: string): DefinitionResult {
      if (!definitionMap) {
        return { word: normalizeWord(word), senses: [], source: 'none' };
      }
      return lookupWordnet(definitionMap, word);
    },
    async ensureTranslationPack(pairId, options) {
      if (lexicons.has(pairId)) return;
      const meta = translationPackById(pairId);
      if (!meta) throw dictionaryError('unsupported', 'That language pack is not available.');
      let bytes = await readPack(pairId);
      if (!bytes && isMockPackMode()) bytes = (await testTranslationBytes(pairId)) ?? undefined;
      if (!bytes) {
        bytes = await downloadPack(meta, options);
        await writePack(pairId, bytes);
      }
      lexicons.set(pairId, loadLexiconPack(bytes));
    },
    async translate(text, pairId, sourceLang = 'en'): Promise<TranslationResult> {
      const meta = translationPackById(pairId) ?? translationPackById(defaultPair);
      if (!meta) {
        return { text, translation: '', sourceLang, targetLang: 'hi', engine: 'none' };
      }
      await this.ensureTranslationPack(meta.id);
      const pack = lexicons.get(meta.id)!;
      const targetLang = meta.targetLang ?? 'hi';
      const { translation, engine } = translateWithLexicon(pack, text, sourceLang, targetLang);
      if (engine !== 'none') {
        return { text, translation, sourceLang, targetLang, engine };
      }
      const rev = translateWithLexicon(pack, text, targetLang, sourceLang);
      if (rev.engine !== 'none') {
        return { text, translation: rev.translation, sourceLang: targetLang, targetLang: sourceLang, engine: 'lexicon' };
      }
      return { text, translation: '', sourceLang, targetLang, engine: 'none' };
    },
  };
}
