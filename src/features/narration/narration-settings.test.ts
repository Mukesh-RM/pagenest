import { describe, expect, it } from 'vitest';
import type { VoiceInfo } from '@/engines/tts/types';
import { migrateNarrationSettings, parseNarrationSettings } from './narration-settings';
import { DEFAULT_NARRATION_SETTINGS } from './types';

const voices: readonly VoiceInfo[] = [
  { id: 'speech-en', name: 'English', engine: 'speech', language: 'en-US', isOwnVoice: false, installed: true },
  {
    id: 'en_US-kristin-medium',
    name: 'Kristin',
    engine: 'piper',
    language: 'en-US',
    isOwnVoice: false,
    installed: true,
    sizeBytes: 60_000_000,
  },
];

describe('migrateNarrationSettings', () => {
  it('migrates legacy Piper default to device speech', () => {
    const saved = parseNarrationSettings({
      engine: 'piper',
      voiceId: 'en_US-kristin-medium',
      speed: 1.25,
      style: 'natural',
      expressive: false,
    });
    const next = migrateNarrationSettings(saved, voices);
    expect(next.engine).toBe('speech');
    expect(next.voiceId).toBe('speech-en');
    expect(next.speed).toBe(1.25);
    expect(next.hdVoiceExplicit).toBe(false);
  });

  it('keeps explicit HD voice choice', () => {
    const saved = {
      ...DEFAULT_NARRATION_SETTINGS,
      engine: 'piper' as const,
      voiceId: 'en_US-kristin-medium',
      hdVoiceExplicit: true,
    };
    const next = migrateNarrationSettings(saved, voices);
    expect(next.engine).toBe('piper');
    expect(next.voiceId).toBe('en_US-kristin-medium');
  });

  it('keeps device speech selection', () => {
    const saved = { ...DEFAULT_NARRATION_SETTINGS, engine: 'speech' as const, voiceId: 'speech-en' };
    expect(migrateNarrationSettings(saved, voices)).toEqual(saved);
  });
});
