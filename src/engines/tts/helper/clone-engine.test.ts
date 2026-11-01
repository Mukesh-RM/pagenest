import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/data/db';
import { MemoryFileStore } from '@/data/opfs';
import { saveOwnVoicePack } from '@/features/voice-studio/data/voice-pack';
import { createCloneEngine } from './clone-engine';
import { createCloneModelStore } from './clone-model-store';
import { miniWavMono } from './test-mini-wav';

describe('clone engine', () => {
  const db = getDb();
  const files = new MemoryFileStore();

  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('lists My voice only after consentful pack exists', async () => {
    const store = createCloneModelStore(files);
    const engine = createCloneEngine({
      db,
      files,
      ...store,
      createWorker: () => new Worker(new URL('./clone.worker.ts', import.meta.url), { type: 'module' }),
    });
    expect(await engine.listVoices()).toHaveLength(0);
    const wav = miniWavMono();
    const row = await saveOwnVoicePack(db, files, {
      name: 'Mine',
      language: 'en',
      consentPhrase: 'silver pilot',
      consentVerifiedAt: 99,
      consentRecording: wav.blob,
      samples: [{ promptId: 'intro-calm', wav: wav.blob }],
    });
    const voices = await engine.listVoices();
    expect(voices).toHaveLength(1);
    expect(voices[0]?.id).toBe(row.id);
    expect(voices[0]?.isOwnVoice).toBe(true);
    await engine.dispose();
  });
});
