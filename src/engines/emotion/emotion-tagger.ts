import type { Emotion } from '@/engines/tts/types';
import type { SegmentedSentence, TaggedSentence } from './types';

/** Rule-based emotion tags from punctuation, caps and speech verbs (blueprint 9.2 step 3). */
export function tagEmotions(sentences: readonly SegmentedSentence[]): TaggedSentence[] {
  return sentences.map((s) => ({ ...s, emotion: inferEmotion(s) }));
}

function inferEmotion(s: SegmentedSentence): Emotion {
  const t = s.text;
  if (/\b(whispered|murmured)\b/i.test(t)) return 'whisper';
  if (/\b(shouted|yelled|screamed|exclaimed)\b/i.test(t)) return 'shout';
  if (/!{2,}/.test(t) || /\b(angry|furious|rage)\b/i.test(t)) return 'angry';
  if (/\?/.test(t) && /\b(afraid|scared|terrified)\b/i.test(t)) return 'afraid';
  if (/\b(sad|cried|sob|tears)\b/i.test(t)) return 'sad';
  if (/\b(happy|joy|laughed|smiled|delighted)\b/i.test(t)) return 'happy';
  if (/!/.test(t) && s.kind === 'dialogue') return 'tense';
  if (/\.\.\.|—/.test(t) && s.kind === 'narration') return 'tense';
  return 'calm';
}
