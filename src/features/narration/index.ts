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
