import { beforeEach, describe, expect, it } from 'vitest';
import { getDb, newId } from '@/data/db';
import { MemoryFileStore } from '@/data/opfs';
import { deleteOwnVoice, listOwnVoices, readVoiceManifest, saveOwnVoicePack } from './voice-pack';

describe('voice-pack storage', () => {
  const db = getDb();
  const files = new MemoryFileStore();

  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('saves manifest and samples under voices/{id}', async () => {
    const wav = new Blob([new Uint8Array([0, 1])], { type: 'audio/wav' });
    const row = await saveOwnVoicePack(db, files, {
      name: 'Studio test',
      language: 'en',
      consentPhrase: 'amber river',
      consentVerifiedAt: 1,
      consentRecording: wav,
      samples: [{ promptId: 'intro-calm', wav }],
    });
    expect(row.isOwnVoice).toBe(true);
    const list = await listOwnVoices(db);
    expect(list).toHaveLength(1);
    const manifest = await readVoiceManifest(files, row.id);
    expect(manifest?.name).toBe('Studio test');
    expect(manifest?.prompts).toHaveLength(1);
  });

  it('delete removes dexie row and opfs folder', async () => {
    const id = newId();
    await db.voices.add({
      id,
      name: 'x',
      engine: 'helper',
      modelRef: `voices/${id}`,
      language: 'en',
      isOwnVoice: true,
      createdAt: 1,
    });
    await files.write(`voices/${id}/manifest.json`, '{}');
    await deleteOwnVoice(db, files, id);
    expect(await db.voices.get(id)).toBeUndefined();
    expect(await files.exists(`voices/${id}/manifest.json`)).toBe(false);
  });
});
