import type { DeliveryPlan, Emotion } from '@/engines/tts/types';

/** One sentence after splitting, with character offsets in the chapter plain text. */
export interface SentenceSpan {
  readonly index: number;
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/** Narration vs dialogue and an optional speaker hint. */
export type SegmentKind = 'narration' | 'dialogue';

export interface SegmentedSentence extends SentenceSpan {
  readonly kind: SegmentKind;
  readonly speaker?: string;
}

export interface TaggedSentence extends SegmentedSentence {
  readonly emotion: Emotion;
}

export interface PlannedSentence extends TaggedSentence {
  readonly delivery: DeliveryPlan;
}
