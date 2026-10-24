// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { tagSentenceEmotion } from './emotion-tagger';

describe('tagSentenceEmotion', () => {
  it('detects whisper from speech verb', () => {
    const tag = tagSentenceEmotion('"Come here," she whispered.', 'whispered');
    expect(tag.emotion).toBe('whisper');
  });

  it('detects question tension', () => {
    const tag = tagSentenceEmotion('Are you sure?');
    expect(tag.emotion).toBe('tense');
  });
});
