import { beforeEach, describe, expect, it } from 'vitest';
import { getDb, newId } from '@/data/db';
import { MemoryFileStore } from '@/data/opfs';
import { saveOwnVoicePack } from '@/features/voice-studio/data/voice-pack';
import { assertConsentManifest, assertOwnVoiceConsent, canUseClonedVoice } from './consent-gate';

describe('voice clone consent gate', () => {
  const db = getDb();
  const files = new MemoryFileStore();

  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('rejects manifest without verified consent', () => {
    expect(() =>
      assertConsentManifest(
        {
          version: 1,
          id: 'x',
          name: 'n',
          language: 'en',
          createdAt: 1,
          consentPhrase: 'a b',
          consentVerifiedAt: 0,
          prompts: [{ id: 'p', file: 'p.wav' }],
          syntheticAudioNote: '',
        },
        'x',
      ),
    ).toThrow(/consent/i);
  });

  it('cannot bypass consent via dexie-only row', async () => {
    const id = newId();
    await db.voices.add({
      id,
      name: 'Fake',
      engine: 'helper',
      modelRef: `voices/${id}`,
      language: 'en',
      isOwnVoice: true,
      createdAt: 1,
    });
    await expect(assertOwnVoiceConsent(db, files, id)).rejects.toMatchObject({ code: 'voice-not-found' });
    expect(await canUseClonedVoice(db, files, id)).toBe(false);
  });

  it('allows only helper own voices with manifest', async () => {
    const wav = new Blob([new Uint8Array([0, 1])], { type: 'audio/wav' });
    const row = await saveOwnVoicePack(db, files, {
      name: 'Casey',
      language: 'en',
      consentPhrase: 'amber river',
      consentVerifiedAt: Date.now(),
      consentRecording: wav,
      samples: [{ promptId: 'intro-calm', wav }],
    });
    await expect(assertOwnVoiceConsent(db, files, row.id)).resolves.toMatchObject({ consentPhrase: 'amber river' });
    expect(await canUseClonedVoice(db, files, row.id)).toBe(true);
  });
});
