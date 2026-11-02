import { getSetting, setSetting, SETTING_KEYS } from '@/data/settings';
import type { PageNestDB } from '@/data/db';
import { createCloneModelStore } from '@/engines/tts/helper/clone-model-store';
import type { FileStore } from '@/data/opfs';
import { SPEECHT5_STACK_MARKER, XVECTOR_MODEL } from '@/engines/tts/helper/clone-models';

export async function hasAcceptedPhoneCloneModelDownload(db: PageNestDB): Promise<boolean> {
  return (await getSetting<boolean>(db, SETTING_KEYS.phoneCloneModelDownloadConsent)) === true;
}

export async function recordPhoneCloneModelDownloadConsent(db: PageNestDB): Promise<void> {
  await setSetting(db, SETTING_KEYS.phoneCloneModelDownloadConsent, true);
}

/** True when x-vector and SpeechT5 stack marker are present in OPFS (offline-ready). */
export async function isPhoneCloneStackCached(files: FileStore): Promise<boolean> {
  const store = createCloneModelStore(files);
  const [xvect, marker] = await Promise.all([
    store.readCloneModel('xvect.onnx'),
    store.readCloneModel(SPEECHT5_STACK_MARKER),
  ]);
  return Boolean(xvect?.byteLength && marker?.byteLength);
}

export function phoneCloneDownloadSummary(): string {
  const mb = Math.round((XVECTOR_MODEL.sizeBytes + 178_000_000) / 1_000_000);
  return `One-time download (~${mb} MB): x-vector speaker model (Apache-2.0) and SpeechT5 TTS (MIT). Stored on this device only; works offline after download.`;
}
