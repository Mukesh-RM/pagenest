import type { DeliveryPlan, Emotion } from '@/engines/tts/types';
import { piperVoiceSupportsSpeakerId } from '@/engines/tts/piper/approved-voices';
import type { EmotionTag } from './emotion-tagger';
import type { SegmentKind } from './dialogue-segmenter';
import { planPauseAfterSentence } from './pause-planner';

/** Piper VITS inference scales (from voice `.onnx.json` `inference` block). */
export interface PiperScalePlan {
  readonly lengthScale: number;
  readonly noiseScale: number;
  readonly noiseW: number;
}

/** Expressive delivery for one sentence/segment (maps to {@link DeliveryPlan} + Piper). */
export interface ExpressiveDeliveryPlan extends DeliveryPlan {
  readonly piper: PiperScalePlan;
  /** Cast / dialogue voice override (engine voice id). */
  readonly voiceId?: string;
  /** Multi-speaker Piper `sid` when the model supports it. */
  readonly speakerId?: number;
  readonly segmentKind: SegmentKind;
}

export interface DeliveryPlannerDefaults {
  readonly baseLengthScale: number;
  readonly baseNoiseScale: number;
  readonly baseNoiseW: number;
  readonly narrationVoiceId: string;
  readonly dialogueVoiceId?: string;
  readonly castVoiceBySpeaker?: Readonly<Record<string, string>>;
  readonly castSpeakerIdBySpeaker?: Readonly<Record<string, number>>;
}

const EMOTION_LENGTH: Readonly<Partial<Record<Emotion, number>>> = {
  calm: 1,
  happy: 0.95,
  sad: 1.12,
  angry: 0.92,
  afraid: 1.05,
  tense: 0.98,
  whisper: 1.08,
  shout: 0.88,
};

const EMOTION_NOISE: Readonly<Partial<Record<Emotion, number>>> = {
  calm: 1,
  happy: 1.05,
  sad: 0.92,
  angry: 1.1,
  afraid: 0.95,
  tense: 1.02,
  whisper: 0.75,
  shout: 1.15,
};

/**
 * Build per-sentence expressive plan: pauses, rate/volume, Piper scales, cast/dialogue voice.
 */
export function planExpressiveDelivery(
  sentence: string,
  tag: EmotionTag,
  segmentKind: SegmentKind,
  speakerHint: string | undefined,
  defaults: DeliveryPlannerDefaults,
  paragraphBreak = false,
): ExpressiveDeliveryPlan {
  const pause = planPauseAfterSentence(sentence);
  const pauseAfterMs = pause.pauseAfterMs + (paragraphBreak ? pause.paragraphBreakMs : 0);

  const emotion = tag.emotion;
  const lengthScale = defaults.baseLengthScale * (EMOTION_LENGTH[emotion] ?? 1);
  const noiseScale = defaults.baseNoiseScale * (EMOTION_NOISE[emotion] ?? 1);
  const noiseW = defaults.baseNoiseW * (EMOTION_NOISE[emotion] ?? 1);

  let rate = 1;
  let volume = 1;
  if (emotion === 'whisper') {
    volume = 0.72;
  }
  if (emotion === 'shout') {
    volume = 1.25;
    rate = 1.05;
  }
  if (emotion === 'sad') {
    rate = 0.94;
  }

  let voiceId = defaults.narrationVoiceId;
  let speakerId: number | undefined;

  if (segmentKind === 'dialogue' && defaults.dialogueVoiceId) {
    voiceId = defaults.dialogueVoiceId;
  }
  if (speakerHint && defaults.castVoiceBySpeaker?.[speakerHint]) {
    voiceId = defaults.castVoiceBySpeaker[speakerHint];
  }
  if (
    speakerHint &&
    defaults.castSpeakerIdBySpeaker?.[speakerHint] !== undefined &&
    piperVoiceSupportsSpeakerId(voiceId)
  ) {
    speakerId = defaults.castSpeakerIdBySpeaker[speakerHint];
  }

  return {
    rate,
    pitch: 0,
    volume,
    pauseAfterMs,
    emotion,
    piper: { lengthScale, noiseScale, noiseW },
    voiceId,
    speakerId,
    segmentKind,
  };
}
