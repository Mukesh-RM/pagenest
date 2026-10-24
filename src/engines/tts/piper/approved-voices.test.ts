// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  APPROVED_PIPER_VOICES,
  FORBIDDEN_PIPER_VOICE_IDS,
  isApprovedPiperVoiceId,
  piperVoiceSupportsSpeakerId,
} from './approved-voices';

describe('approved Piper voices', () => {
  it('lists only vetted OK voice ids', () => {
    expect(APPROVED_PIPER_VOICES).toHaveLength(11);
    for (const v of APPROVED_PIPER_VOICES) {
      expect(isApprovedPiperVoiceId(v.id)).toBe(true);
    }
    expect(isApprovedPiperVoiceId('en_US-amy-low')).toBe(false);
  });

  it('marks multi-speaker voices for optional sid cast mapping', () => {
    expect(piperVoiceSupportsSpeakerId('en_US-ljspeech-medium')).toBe(false);
    expect(piperVoiceSupportsSpeakerId('en_US-libritts-high')).toBe(true);
    expect(piperVoiceSupportsSpeakerId('de_DE-mls-medium')).toBe(true);
  });

  it('documents forbidden ids for audit grep', () => {
    expect(FORBIDDEN_PIPER_VOICE_IDS).toContain('en_US-libritts_r-medium');
    expect(FORBIDDEN_PIPER_VOICE_IDS).toContain('en_US-lessac-medium');
  });
});
