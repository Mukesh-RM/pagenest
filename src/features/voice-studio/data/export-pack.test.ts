import { describe, expect, it } from 'vitest';
import { MemoryFileStore } from '@/data/opfs';
import { exportOwnVoiceZip } from './export-pack';
import { saveOwnVoicePack } from './voice-pack';
import { getDb } from '@/data/db';

describe('exportOwnVoiceZip', () => {
  it('builds a zip with manifest and audio (jszip MIT)', async () => {
    const db = getDb();
    await db.delete();
    await db.open();
    const files = new MemoryFileStore();
    const wav = new Blob([new Uint8Array([0, 1, 2])], { type: 'audio/wav' });
    const voice = await saveOwnVoicePack(db, files, {
      name: 'Export me',
      language: 'en',
      consentPhrase: 'pebble quartz',
      consentVerifiedAt: 2,
      consentRecording: wav,
      samples: [{ promptId: 'intro-calm', wav }],
    });
    const zip = await exportOwnVoiceZip(files, voice.id);
    expect(zip.size).toBeGreaterThan(50);
    expect(zip.type).toBe('application/zip');
  });
});
