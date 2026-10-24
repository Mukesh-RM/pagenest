export type {
  HighlightGranularity,
  NarrationHighlightEvent,
  NarrationHighlightListener,
  NarrationPlaybackState,
  NarrationPlaybackStatus,
} from './highlight-contract';
export {
  hasSentenceSegmenter,
  segmentSentences,
  segmentWithRules,
  type SentenceSpan,
} from './sentence-segmenter';
export {
  SpeechNarrationSession,
  type SpeechNarrationSessionOptions,
  type SpeechNarrationStartOptions,
} from './speech-narration-session';
export { tagSentenceEmotion, type EmotionTag } from './expressive/emotion-tagger';
export { segmentNarrationAndDialogue, type NarrationSegment } from './expressive/dialogue-segmenter';
export {
  planExpressiveDelivery,
  type ExpressiveDeliveryPlan,
  type PiperScalePlan,
} from './expressive/delivery-planner';
export { planPauseAfterSentence, appendSilencePcm } from './expressive/pause-planner';
