/** A downloadable offline dictionary or translation pack. */
export interface DictionaryPackMeta {
  readonly id: string;
  readonly name: string;
  readonly kind: 'definitions' | 'translation';
  /** BCP 47 source language for translation packs. */
  readonly sourceLang?: string;
  readonly targetLang?: string;
  readonly sizeBytes: number;
  readonly url: string;
  readonly license: string;
  readonly attribution: string;
  /** Pack encoding on disk / over the wire. */
  readonly format?: 'json' | 'wnpk' | 'wnpk-gz';
  /** Mozilla registry keys (e.g. `enes`, `esen`) downloaded for neural translation. */
  readonly bergamotKeys?: readonly string[];
  /** Instant word-level fallback JSON (always fetched with the pack). */
  readonly lexiconUrl?: string;
}

export interface DefinitionSense {
  readonly pos: string;
  readonly glosses: readonly string[];
}

export interface DefinitionResult {
  readonly word: string;
  readonly senses: readonly DefinitionSense[];
  readonly source: 'wordnet' | 'none';
}

export interface TranslationResult {
  readonly text: string;
  readonly translation: string;
  readonly sourceLang: string;
  readonly targetLang: string;
  /** `lexicon` for pack lookup; `bergamot` when the WASM model ran. */
  readonly engine: 'lexicon' | 'bergamot' | 'none';
}

export interface PackProgress {
  readonly received: number;
  readonly total: number;
}

export interface DictionaryEngine {
  readonly id: string;
  /** Whether a definitions pack is loaded and ready for sync lookup. */
  isReady(): boolean;
  isDefinitionPackReady(packId: string): boolean;
  ensureDefinitionsPack(
    packId?: string,
    options?: { signal?: AbortSignal; onProgress?: (p: PackProgress) => void },
  ): Promise<void>;
  /** Sync after {@link ensureDefinitionsPack}; target under 1 ms for cached words. */
  define(word: string): DefinitionResult;
  listTranslationPacks(): readonly DictionaryPackMeta[];
  isTranslationReady(pairId: string): boolean;
  ensureTranslationPack(
    pairId: string,
    options?: { signal?: AbortSignal; onProgress?: (p: PackProgress) => void },
  ): Promise<void>;
  translate(text: string, pairId: string, sourceLang?: string): Promise<TranslationResult>;
  listDefinitionPacks(): readonly DictionaryPackMeta[];
  /** Load packs already stored on the device (no network). */
  hydrate(): Promise<void>;
}
