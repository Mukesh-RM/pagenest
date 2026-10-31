import type { EntityId } from '@/app/contracts';
import type { NarrationStyle } from '@/data/schema';
import type { PlannedSentence } from '@/engines/emotion/types';
import type { VoiceEngineId } from '@/engines/tts/types';

export interface NarrationSettings {
  readonly engine: VoiceEngineId;
  readonly voiceId: string;
  readonly speed: number;
  readonly style: NarrationStyle;
  readonly expressive: boolean;
}

export const DEFAULT_NARRATION_SETTINGS: NarrationSettings = {
  engine: 'piper',
  voiceId: 'en_US-libritts-high',
  speed: 1,
  style: 'natural',
  expressive: false,
};

export interface NarrationPlaybackState {
  readonly playing: boolean;
  readonly preparing: boolean;
  readonly activeSentence: number;
  readonly plan: readonly PlannedSentence[];
  readonly bookId?: EntityId;
  readonly error?: string;
}

export interface SentenceTiming {
  readonly index: number;
  readonly startSec: number;
  readonly endSec: number;
}
