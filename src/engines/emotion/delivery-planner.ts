import type { DeliveryPlan, Emotion } from '@/engines/tts/types';
import type { NarrationStyle } from '@/data/schema';
import type { PlannedSentence, TaggedSentence } from './types';

const BASE: DeliveryPlan = { rate: 1, pitch: 0, volume: 1, pauseAfterMs: 280 };

/** Turn tagged sentences into per-sentence synthesis plans. */
export function planDelivery(
  sentences: readonly TaggedSentence[],
  style: NarrationStyle,
  dialogueVoiceShift = true,
): PlannedSentence[] {
  return sentences.map((s, i) => ({
    ...s,
    delivery: planOne(s, style, dialogueVoiceShift, sentences[i - 1]),
  }));
}

function planOne(
  s: TaggedSentence,
  style: NarrationStyle,
  dialogueVoiceShift: boolean,
  prev: TaggedSentence | undefined,
): DeliveryPlan {
  let plan = { ...BASE };
  if (style === 'natural') return plan;

  plan = applyEmotion(plan, s.emotion);
  if (style === 'expressive' || style === 'cast') {
    if (dialogueVoiceShift && s.kind === 'dialogue') plan = { ...plan, pitch: plan.pitch + 1.5, rate: plan.rate * 1.02 };
    if (style === 'cast' && s.speaker) plan = { ...plan, pitch: pitchForSpeaker(s.speaker) };
  }
  if (prev && prev.text.endsWith('—')) plan = { ...plan, pauseAfterMs: plan.pauseAfterMs + 200 };
  if (s.text.endsWith('?')) plan = { ...plan, pitch: plan.pitch + 0.5, pauseAfterMs: plan.pauseAfterMs + 120 };
  if (s.text.endsWith('!')) plan = { ...plan, rate: plan.rate * 1.05, volume: Math.min(1.4, plan.volume * 1.08) };
  return plan;
}

function applyEmotion(plan: DeliveryPlan, emotion: Emotion): DeliveryPlan {
  switch (emotion) {
    case 'whisper':
      return { ...plan, volume: 0.55, rate: plan.rate * 0.92, pitch: plan.pitch - 1 };
    case 'shout':
      return { ...plan, volume: 1.35, rate: plan.rate * 1.08, pitch: plan.pitch + 1 };
    case 'angry':
      return { ...plan, rate: plan.rate * 1.06, volume: 1.15, pitch: plan.pitch + 0.5 };
    case 'afraid':
      return { ...plan, rate: plan.rate * 0.95, pitch: plan.pitch - 0.5, pauseAfterMs: plan.pauseAfterMs + 80 };
    case 'sad':
      return { ...plan, rate: plan.rate * 0.9, pitch: plan.pitch - 0.8, volume: 0.9 };
    case 'happy':
      return { ...plan, rate: plan.rate * 1.04, pitch: plan.pitch + 0.6 };
    case 'tense':
      return { ...plan, rate: plan.rate * 0.98, pauseAfterMs: plan.pauseAfterMs + 160 };
    default:
      return plan;
  }
}

function pitchForSpeaker(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return ((h % 7) - 3) * 0.75;
}
