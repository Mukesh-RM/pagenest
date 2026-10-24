import type { Emotion } from '@/engines/tts/types';
import { EMOTION_WORD_LEXICON, SPEECH_VERB_LEXICON } from './emotion-lexicon';

export interface EmotionTag {
  readonly emotion: Emotion;
  readonly confidence: number;
  readonly reasons: readonly string[];
}

const DEFAULT: EmotionTag = { emotion: 'calm', confidence: 0.5, reasons: ['default'] };

/**
 * Rule-based emotion tagger (punctuation, caps, MIT in-repo lexicon, speech verbs).
 * No external models or restricted lexicons.
 */
export function tagSentenceEmotion(sentence: string, dialogueVerb?: string): EmotionTag {
  const reasons: string[] = [];
  const scores = new Map<Emotion, number>();

  const bump = (emotion: Emotion, amount: number, reason: string) => {
    scores.set(emotion, (scores.get(emotion) ?? 0) + amount);
    reasons.push(reason);
  };

  const trimmed = sentence.trim();
  if (trimmed.endsWith('?')) {
    bump('tense', 0.35, 'question');
  }
  if (trimmed.endsWith('!')) {
    bump('happy', 0.25, 'exclamation');
    bump('shout', 0.2, 'exclamation');
  }
  if (trimmed.includes('...') || trimmed.includes('…')) {
    bump('sad', 0.2, 'ellipsis');
    bump('tense', 0.15, 'ellipsis');
  }

  const words = trimmed.toLowerCase().match(/[a-z']+/g) ?? [];
  for (const w of words) {
    const hit = EMOTION_WORD_LEXICON[w];
    if (hit) {
      bump(hit.emotion, hit.weight * 0.5, `word:${w}`);
    }
  }

  if (dialogueVerb) {
    const verb = dialogueVerb.toLowerCase();
    const speech = SPEECH_VERB_LEXICON[verb];
    if (speech) {
      bump(speech.emotion, speech.weight, `verb:${verb}`);
    }
  }

  const allCaps = /\b[A-Z]{3,}\b/.test(sentence);
  if (allCaps) {
    bump('shout', 0.4, 'all-caps');
    bump('angry', 0.2, 'all-caps');
  }

  if (scores.size === 0) {
    return DEFAULT;
  }

  let best: Emotion = 'calm';
  let bestScore = -1;
  for (const [emotion, score] of scores) {
    if (score > bestScore) {
      best = emotion;
      bestScore = score;
    }
  }
  const confidence = Math.min(1, 0.45 + bestScore * 0.25);
  return { emotion: best, confidence, reasons };
}
