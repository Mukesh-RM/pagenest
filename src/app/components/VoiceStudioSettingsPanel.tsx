import { useEffect, useState } from 'react';
import { createFileStore, type FileStore } from '@/data/opfs';
import { LazyVoiceStudioRoot } from '@/features/voice-studio';
import { useServices } from '../services-context';

/** Settings → Voices: lazy Voice Studio (recording, consent, My Voice Pack). */
export function VoiceStudioSettingsPanel() {
  const { db } = useServices();
  const [files, setFiles] = useState<FileStore | undefined>();

  useEffect(() => {
    let active = true;
    void createFileStore().then((store) => {
      if (active) setFiles(store);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-labelledby="pn-set-voices" className="pn-set-card">
      <h2 id="pn-set-voices" className="pn-set-card__title">
        Voices
      </h2>
      <p className="pn-set-card__text">
        Record your own voice for read-aloud. Samples stay on this device until you delete them.
      </p>
      {files ? <LazyVoiceStudioRoot services={{ db, files }} /> : <p className="pn-set-card__text">Loading…</p>}
    </section>
  );
}
