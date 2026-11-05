import { describe, expect, it } from 'vitest';
import { getDb } from '@/data/db';
import { MemoryFileStore } from '@/data/opfs';
import {
  hasAcceptedPhoneCloneModelDownload,
  isPhoneCloneStackCached,
  recordPhoneCloneModelDownloadConsent,
} from './phone-clone-consent';
import { createCloneModelStore } from '@/engines/tts/helper/clone-model-store';
import { SPEECHT5_STACK_MARKER } from '@/engines/tts/helper/clone-models';

describe('phone clone consent', () => {
  const db = getDb();
  const files = new MemoryFileStore();

  it('tracks download consent in settings', async () => {
    await db.delete();
    await db.open();
    expect(await hasAcceptedPhoneCloneModelDownload(db)).toBe(false);
    await recordPhoneCloneModelDownloadConsent(db);
    expect(await hasAcceptedPhoneCloneModelDownload(db)).toBe(true);
  });

  it('detects cached stack from OPFS marker files', async () => {
    expect(await isPhoneCloneStackCached(files)).toBe(false);
    const store = createCloneModelStore(files);
    await store.writeCloneModel('xvect.onnx', new Uint8Array([1, 2, 3]).buffer);
    await store.writeCloneModel(SPEECHT5_STACK_MARKER, new TextEncoder().encode('1').buffer);
    expect(await isPhoneCloneStackCached(files)).toBe(true);
  });
});
