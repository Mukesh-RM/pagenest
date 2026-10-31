import type { NarrationStyle } from '@/data/schema';
import { planDelivery } from './delivery-planner';
import { tagEmotions } from './emotion-tagger';
import { segmentSentences } from './segment';
import { splitSentences } from './sentence-split';
import type { PlannedSentence } from './types';

/** Full emotion pipeline for one chapter plain-text string. */
export function buildNarrationPlan(text: string, style: NarrationStyle = 'natural'): PlannedSentence[] {
  const sentences = splitSentences(text);
  const segmented = segmentSentences(sentences);
  const tagged = tagEmotions(segmented);
  return planDelivery(tagged, style);
}

export { splitSentences, segmentSentences, tagEmotions, planDelivery };
