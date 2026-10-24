import type { ProgressReport } from '@/app/contracts';

/**
 * Voice engine contract (blueprint sections 9 and 12.2).
 *
 * Speech, Piper, Kokoro and the Voice Helper all implement `VoiceEngine`, so
 * the narration pipeline never knows which one it is talking to. Engines run
 * heavy work in workers. Model files are stored in OPFS; the only network use
 * allowed is the optional, user-started download in {@link VoiceEngine.prepareVoice}.
 */
export interface VoiceEngine {
  /** Stable id, one of {@link VoiceEngineId}. */
  readonly id: VoiceEngineId;
  /** Quality tier from blueprint section 9.3 (0 is the basic fallback). */
  readonly tier: 0 | 1 | 2 | 3;
  readonly capabilities: VoiceEngineCapabilities;

  /** Whether the engine can run on this device right now, with a plain-words reason if not. */
  checkAvailability(): Promise<VoiceAvailability>;

  /** Voices this engine knows, optionally only for a BCP 47 language such as `en` or `hi`. */
  listVoices(language?: string): Promise<readonly VoiceInfo[]>;

  /**
   * Make a voice ready (load it, or download it when `allowDownload` is true).
   * Resolves when {@link VoiceEngine.synthesize} can use the voice.
   *
   * @throws VoiceEngineError with code `download-required` when the model is
   *   missing and `allowDownload` is false.
   */
  prepareVoice(voiceId: string, options?: PrepareOptions): Promise<void>;

  /**
   * Speak or render one piece of text. Engines with `capabilities.output ===
   * 'buffer'` return audio; engines with `'live'` speak straight to the device
   * and resolve when done (foreground only).
   */
  synthesize(request: SynthesisRequest): Promise<SynthesisResult>;

  /** Free models, workers and memory. */
  dispose(): Promise<void>;
}

/** Engines named in blueprint section 9.3. */
export type VoiceEngineId = 'speech' | 'piper' | 'kokoro' | 'helper';

/** What an engine can do. */
export interface VoiceEngineCapabilities {
  /** `buffer` engines return audio the app caches and plays through the audio element; `live` engines speak directly. */
  readonly output: 'buffer' | 'live';
  /** True when audio keeps playing with the screen off (always true for `buffer`). */
  readonly backgroundSafe: boolean;
  /** True when the engine honors {@link DeliveryPlan.pitch}, `rate` and `volume`. */
  readonly supportsProsody: boolean;
  /** True when the engine accepts an emotion in {@link DeliveryPlan.emotion}. */
  readonly supportsEmotion: boolean;
  /** True when voices can be made from the user's own recordings. */
  readonly supportsOwnVoice: boolean;
  /** True when voices need a model download first. */
  readonly needsDownload: boolean;
}

/** Result of {@link VoiceEngine.checkAvailability}. */
export type VoiceAvailability =
  | { readonly available: true }
  | { readonly available: false; readonly reason: string };

/** One voice an engine can speak with. Shape lines up with the `voices` store. */
export interface VoiceInfo {
  readonly id: string;
  readonly name: string;
  readonly engine: VoiceEngineId;
  /** BCP 47 language tag. */
  readonly language: string;
  /** True for voices made from the user's own recordings. */
  readonly isOwnVoice: boolean;
  /** Approximate download size in bytes, when a download is needed. */
  readonly sizeBytes?: number;
  /** True when the model is already on the device. */
  readonly installed: boolean;
}

/** Options for {@link VoiceEngine.prepareVoice}. */
export interface PrepareOptions {
  /** Only true when the user asked for the download. */
  readonly allowDownload?: boolean;
  readonly onProgress?: (progress: ProgressReport) => void;
  readonly signal?: AbortSignal;
}

/** Emotion labels from the emotion tagger (blueprint section 9.2, step 3). */
export type Emotion =
  | 'calm'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'afraid'
  | 'tense'
  | 'whisper'
  | 'shout';

/** Per-sentence delivery from the delivery planner (blueprint section 9.2, step 4). */
export interface DeliveryPlan {
  /** Speed multiplier, 1 is the voice's normal pace. */
  readonly rate: number;
  /** Pitch shift in semitones, 0 is normal. */
  readonly pitch: number;
  /** Volume multiplier, 0 to 1.5. */
  readonly volume: number;
  /** Silence to append after the sentence, in milliseconds. */
  readonly pauseAfterMs: number;
  /** Emotion hint; engines without `supportsEmotion` ignore it. */
  readonly emotion?: Emotion;
}

/** One unit of speech, normally a sentence. */
export interface SynthesisRequest {
  readonly voiceId: string;
  readonly text: string;
  /** BCP 47 language tag of the text. */
  readonly language: string;
  readonly delivery: DeliveryPlan;
  readonly signal?: AbortSignal;
}

/** Rendered audio, mono PCM. */
export interface BufferResult {
  readonly kind: 'buffer';
  /** Samples in the range -1 to 1. */
  readonly samples: Float32Array;
  readonly sampleRate: number;
  readonly durationSec: number;
}

/** The engine spoke the text directly to the device and has finished. */
export interface LiveResult {
  readonly kind: 'live';
}

export type SynthesisResult = BufferResult | LiveResult;

/** Why a voice engine call failed. */
export type VoiceEngineErrorCode =
  | 'unavailable'
  | 'download-required'
  | 'voice-not-found'
  | 'aborted'
  | 'failed';

/** Error thrown by voice engines. `message` is safe to show to the user. */
export interface VoiceEngineError extends Error {
  readonly code: VoiceEngineErrorCode;
}
