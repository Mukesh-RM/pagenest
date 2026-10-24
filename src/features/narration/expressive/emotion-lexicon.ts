/**
 * MIT-licensed, in-repo emotion hints for the rule tagger (Phase 5 spike).
 * Not derived from NRC EmoLex or other restricted lexicons.
 */

import type { Emotion } from '@/engines/tts/types';

export interface EmotionLexiconEntry {
  readonly emotion: Emotion;
  readonly weight: number;
}

/** Lowercase whole-word → emotion signal. */
export const EMOTION_WORD_LEXICON: Readonly<Record<string, EmotionLexiconEntry>> = {
  happy: { emotion: 'happy', weight: 1 },
  joy: { emotion: 'happy', weight: 0.9 },
  laughed: { emotion: 'happy', weight: 0.8 },
  smiled: { emotion: 'happy', weight: 0.7 },
  glad: { emotion: 'happy', weight: 0.7 },
  sad: { emotion: 'sad', weight: 1 },
  cried: { emotion: 'sad', weight: 0.9 },
  tears: { emotion: 'sad', weight: 0.7 },
  grief: { emotion: 'sad', weight: 0.8 },
  angry: { emotion: 'angry', weight: 1 },
  furious: { emotion: 'angry', weight: 0.95 },
  rage: { emotion: 'angry', weight: 0.9 },
  shouted: { emotion: 'shout', weight: 0.85 },
  yelled: { emotion: 'shout', weight: 0.85 },
  screamed: { emotion: 'shout', weight: 0.9 },
  afraid: { emotion: 'afraid', weight: 1 },
  scared: { emotion: 'afraid', weight: 0.9 },
  terrified: { emotion: 'afraid', weight: 0.95 },
  nervous: { emotion: 'tense', weight: 0.7 },
  tense: { emotion: 'tense', weight: 0.9 },
  anxious: { emotion: 'tense', weight: 0.75 },
  whispered: { emotion: 'whisper', weight: 0.95 },
  murmured: { emotion: 'whisper', weight: 0.8 },
  calm: { emotion: 'calm', weight: 1 },
  quietly: { emotion: 'calm', weight: 0.6 },
  peace: { emotion: 'calm', weight: 0.5 },
};

/** Dialogue verbs that cue delivery (blueprint §9.2). */
export const SPEECH_VERB_LEXICON: Readonly<Record<string, EmotionLexiconEntry>> = {
  whispered: { emotion: 'whisper', weight: 1 },
  murmured: { emotion: 'whisper', weight: 0.9 },
  shouted: { emotion: 'shout', weight: 1 },
  yelled: { emotion: 'shout', weight: 0.95 },
  screamed: { emotion: 'shout', weight: 1 },
  laughed: { emotion: 'happy', weight: 0.7 },
  sobbed: { emotion: 'sad', weight: 0.85 },
  growled: { emotion: 'angry', weight: 0.8 },
};
