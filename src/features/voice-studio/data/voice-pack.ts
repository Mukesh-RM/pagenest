import type { PageNestDB } from '@/data/db';
import { newId } from '@/data/db';
import { FilePaths, type FileStore } from '@/data/opfs';
import type { VoiceRecord } from '@/data/schema';
import { readBlobUtf8 } from './blob-read';

/** Metadata stored beside WAV samples in OPFS (`voices/{id}/manifest.json`). */
export interface VoicePackManifest {
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly language: string;
  readonly createdAt: number;
  readonly consentPhrase: string;
  readonly consentVerifiedAt: number;
  readonly prompts: readonly { readonly id: string; readonly file: string }[];
  readonly syntheticAudioNote: string;
}

export interface SavedVoiceSample {
  readonly promptId: string;
  readonly wav: Blob;
}

export interface SaveOwnVoiceInput {
  readonly name: string;
  readonly language: string;
  readonly consentPhrase: string;
  readonly consentVerifiedAt: number;
  readonly consentRecording: Blob;
  readonly samples: readonly SavedVoiceSample[];
}

const MANIFEST = 'manifest.json';
const CONSENT_FILE = 'consent.wav';

function voiceDir(voiceId: string): string {
  return FilePaths.voiceModel(voiceId);
}

function manifestPath(voiceId: string): string {
  return `${voiceDir(voiceId)}/${MANIFEST}`;
}

export async function listOwnVoices(db: PageNestDB): Promise<VoiceRecord[]> {
  const rows = await db.voices.orderBy('createdAt').reverse().toArray();
  return rows.filter((v) => v.isOwnVoice);
}

export async function saveOwnVoicePack(
  db: PageNestDB,
  files: FileStore,
  input: SaveOwnVoiceInput,
): Promise<VoiceRecord> {
  const id = newId();
  const dir = voiceDir(id);
  const prompts: { id: string; file: string }[] = [];

  await files.write(`${dir}/${CONSENT_FILE}`, input.consentRecording);
  for (const sample of input.samples) {
    const file = `${sample.promptId}.wav`;
    prompts.push({ id: sample.promptId, file });
    await files.write(`${dir}/${file}`, sample.wav);
  }

  const manifest: VoicePackManifest = {
    version: 1,
    id,
    name: input.name.trim(),
    language: input.language,
    createdAt: Date.now(),
    consentPhrase: input.consentPhrase,
    consentVerifiedAt: input.consentVerifiedAt,
    prompts,
    syntheticAudioNote: 'Synthetic voice generated from the device owner’s recordings.',
  };
  await files.write(manifestPath(id), JSON.stringify(manifest, null, 2));

  const record: VoiceRecord = {
    id,
    name: manifest.name,
    engine: 'helper',
    modelRef: dir,
    language: input.language,
    isOwnVoice: true,
    createdAt: manifest.createdAt,
  };
  await db.voices.add(record);
  return record;
}

/** Remove Dexie row, OPFS samples, and any render rows tied to this voice. */
export async function deleteOwnVoice(db: PageNestDB, files: FileStore, voiceId: string): Promise<void> {
  const row = await db.voices.get(voiceId);
  if (!row?.isOwnVoice) return;
  await db.transaction('rw', db.voices, db.renders, async () => {
    await db.renders.where('voiceId').equals(voiceId).delete();
    await db.voices.delete(voiceId);
  });
  const dir = row.modelRef ?? voiceDir(voiceId);
  await files.remove(dir);
}

export async function readVoiceManifest(files: FileStore, voiceId: string): Promise<VoicePackManifest | undefined> {
  const path = manifestPath(voiceId);
  if (!(await files.exists(path))) return undefined;
  const file = await files.open(path);
  const text = await readBlobUtf8(file);
  return JSON.parse(text) as VoicePackManifest;
}

export async function openVoiceSample(files: FileStore, voiceId: string, fileName: string): Promise<File> {
  return files.open(`${voiceDir(voiceId)}/${fileName}`);
}
