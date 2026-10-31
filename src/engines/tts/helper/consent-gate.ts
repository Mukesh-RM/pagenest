import type { PageNestDB } from '@/data/db';
import type { FileStore } from '@/data/opfs';
import { voiceError } from '../errors';
import { readVoiceManifest, type VoicePackManifest } from '@/features/voice-studio/data/voice-pack';

/** Minimum fields that must be present before any cloned speech is allowed. */
export function assertConsentManifest(manifest: VoicePackManifest | undefined, voiceId: string): VoicePackManifest {
  if (!manifest || manifest.id !== voiceId) {
    throw voiceError('voice-not-found', 'This voice is missing or incomplete.');
  }
  if (!manifest.consentPhrase?.trim()) {
    throw voiceError('failed', 'Recorded consent is missing for this voice.');
  }
  if (!Number.isFinite(manifest.consentVerifiedAt) || manifest.consentVerifiedAt <= 0) {
    throw voiceError('failed', 'Live consent was not verified for this voice.');
  }
  if (!manifest.prompts?.length) {
    throw voiceError('failed', 'Record at least one speech sample before using this voice.');
  }
  return manifest;
}

/**
 * Non-bypassable gate: Dexie row must be an own voice on the helper engine and OPFS manifest must
 * carry a verified consent timestamp.
 */
export async function assertOwnVoiceConsent(
  db: PageNestDB,
  files: FileStore,
  voiceId: string,
): Promise<VoicePackManifest> {
  const row = await db.voices.get(voiceId);
  if (!row?.isOwnVoice || row.engine !== 'helper') {
    throw voiceError('voice-not-found', 'Only your own recorded voice can be used here.');
  }
  const manifest = await readVoiceManifest(files, voiceId);
  return assertConsentManifest(manifest, voiceId);
}

export async function canUseClonedVoice(db: PageNestDB, files: FileStore, voiceId: string): Promise<boolean> {
  try {
    await assertOwnVoiceConsent(db, files, voiceId);
    return true;
  } catch {
    return false;
  }
}
