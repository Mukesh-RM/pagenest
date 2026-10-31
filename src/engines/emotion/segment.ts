import type { SegmentedSentence, SentenceSpan } from './types';

const SPEECH_VERB =
  /\b(said|asked|whispered|shouted|cried|murmured|replied|answered|exclaimed|muttered|yelled|screamed)\b/i;

/** Mark dialogue inside quotes and guess the speaker from nearby speech verbs. */
export function segmentSentences(sentences: readonly SentenceSpan[]): SegmentedSentence[] {
  return sentences.map((s) => {
    const quoted = extractQuoted(s.text);
    if (quoted) {
      const speaker = guessSpeaker(s.text, quoted);
      return { ...s, kind: 'dialogue', ...(speaker ? { speaker } : {}) };
    }
    return { ...s, kind: 'narration' };
  });
}

function extractQuoted(text: string): string | undefined {
  const m = text.match(/[“"]([^”"]+)[”"]/u) ?? text.match(/'([^']+)'/);
  return m?.[1]?.trim();
}

function guessSpeaker(text: string, dialogue: string): string | undefined {
  const before = text.slice(0, text.indexOf(dialogue)).trim();
  const after = text.slice(text.indexOf(dialogue) + dialogue.length).trim();
  const tag = `${before} ${after}`;
  const m = tag.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+\w*\s*$/);
  if (m?.[1]) return m[1];
  const verb = tag.match(SPEECH_VERB);
  if (verb) {
    const name = before.match(/\b([A-Z][a-z]+)\s*[,—-]?\s*$/);
    if (name?.[1]) return name[1];
  }
  return undefined;
}
