import type {
  DeliveryPlan,
  SynthesisRequest,
  SynthesisResult,
  VoiceAvailability,
  VoiceEngine,
  VoiceInfo,
  PrepareOptions,
} from './types';
import { createVoiceEngineError } from './voice-engine-error';
import {
  defaultUtteranceFactory,
  getBrowserSpeechSynthesis,
  speakToCompletion,
  type SpeechSynthesisPort,
  type UtteranceFactory,
} from './speech-synthesis-adapter';

const MIN_RATE = 0.5;
const MAX_RATE = 3;

export interface SpeechSynthesisEngineOptions {
  readonly synth?: SpeechSynthesisPort;
  readonly utteranceFactory?: UtteranceFactory;
}

function clampRate(delivery: DeliveryPlan): number {
  const base = delivery.rate > 0 ? delivery.rate : 1;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, base));
}

function pitchToSpeechPitch(pitchSemitones: number): number {
  const factor = Math.pow(2, pitchSemitones / 12);
  return Math.min(2, Math.max(0, factor));
}

/**
 * Tier-0 {@link VoiceEngine}: browser `speechSynthesis` (foreground fallback).
 * Does not support background playback with the screen off.
 */
export class SpeechSynthesisVoiceEngine implements VoiceEngine {
  readonly id = 'speech' as const;
  readonly tier = 0 as const;
  readonly capabilities = {
    output: 'live' as const,
    backgroundSafe: false,
    supportsProsody: true,
    supportsEmotion: false,
    supportsOwnVoice: false,
    needsDownload: false,
  };

  private readonly synth: SpeechSynthesisPort | undefined;
  private readonly utteranceFactory: UtteranceFactory;

  constructor(options: SpeechSynthesisEngineOptions = {}) {
    this.synth = options.synth ?? getBrowserSpeechSynthesis();
    this.utteranceFactory = options.utteranceFactory ?? defaultUtteranceFactory();
  }

  async checkAvailability(): Promise<VoiceAvailability> {
    if (!this.synth) {
      return {
        available: false,
        reason: 'This browser does not support speech synthesis.',
      };
    }
    return { available: true };
  }

  async listVoices(language?: string): Promise<readonly VoiceInfo[]> {
    const availability = await this.checkAvailability();
    if (!availability.available) {
      return [];
    }
    const raw = this.synth?.getVoices() ?? [];
    const langPrefix = language?.toLowerCase();
    const mapped = raw
      .filter((v) => !langPrefix || v.lang.toLowerCase().startsWith(langPrefix))
      .map((v) => ({
        id: v.voiceURI,
        name: v.name,
        engine: 'speech' as const,
        language: v.lang,
        isOwnVoice: false,
        installed: true,
      }));
    return mapped;
  }

  async prepareVoice(_voiceId: string, _options?: PrepareOptions): Promise<void> {
    const availability = await this.checkAvailability();
    if (!availability.available) {
      throw createVoiceEngineError('unavailable', availability.reason);
    }
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const availability = await this.checkAvailability();
    if (!availability.available) {
      throw createVoiceEngineError('unavailable', availability.reason);
    }
    if (request.signal?.aborted) {
      throw createVoiceEngineError('aborted', 'Speech was cancelled.');
    }
    const voices = await this.listVoices();
    if (!voices.some((v) => v.id === request.voiceId)) {
      throw createVoiceEngineError('voice-not-found', 'That voice is not available on this device.');
    }

    const synth = this.synth;
    if (!synth) {
      throw createVoiceEngineError('unavailable', 'Speech synthesis is not available.');
    }

    const rate = clampRate(request.delivery);
    const pitch = pitchToSpeechPitch(request.delivery.pitch);
    const volume = Math.min(1, Math.max(0, request.delivery.volume));

    try {
      await speakToCompletion(synth, this.utteranceFactory, {
        text: request.text,
        lang: request.language,
        rate,
        pitch,
        volume,
        voiceUri: request.voiceId,
        signal: request.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw createVoiceEngineError('aborted', 'Speech was cancelled.');
      }
      const message = err instanceof Error ? err.message : 'Speech synthesis failed.';
      throw createVoiceEngineError('failed', message);
    }

    return { kind: 'live' };
  }

  async dispose(): Promise<void> {
    this.synth?.cancel();
  }
}

export function createSpeechSynthesisEngine(
  options?: SpeechSynthesisEngineOptions,
): SpeechSynthesisVoiceEngine {
  return new SpeechSynthesisVoiceEngine(options);
}
