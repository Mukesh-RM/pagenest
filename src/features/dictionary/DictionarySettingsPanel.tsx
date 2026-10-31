import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServices } from '@/app/services-context';
import { formatBytes } from '@/data/storage';
import { Button } from '@/ui';
import { createDictionaryEngine } from './dictionary-engine-factory';
import './dictionary.css';

/** Settings card: optional offline dictionary and translation packs with sizes before download. */
export function DictionarySettingsPanel() {
  const { data } = useServices();
  const engine = useMemo(() => createDictionaryEngine({ data }), [data]);
  const [busy, setBusy] = useState<string | undefined>();
  const [ready, setReady] = useState({ definitions: false, translateEnHi: false });

  const refresh = useCallback(async () => {
    await engine.hydrate();
    setReady({
      definitions: engine.isReady(),
      translateEnHi: engine.isTranslationReady('translate-en-hi'),
    });
  }, [engine]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const install = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
      await refresh();
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <section className="pn-settings-card" aria-labelledby="pn-dict-settings-title">
      <h2 id="pn-dict-settings-title" className="pn-settings-card__title">
        Dictionary and translation
      </h2>
      <p className="pn-settings-card__lead">Free offline packs. Nothing is sent to a server.</p>
      {engine.listDefinitionPacks().map((pack) => (
        <div key={pack.id} className="pn-dict-settings__row">
          <strong>{pack.name}</strong>
          <span className="pn-dict-settings__meta">
            {formatBytes(pack.sizeBytes)} · {pack.license}
            {ready.definitions ? ' · On device' : ''}
          </span>
          <Button
            variant="secondary"
            disabled={busy === pack.id || ready.definitions}
            onClick={() => void install(pack.id, () => engine.ensureDefinitionsPack())}
          >
            {ready.definitions ? 'Installed' : busy === pack.id ? 'Downloading…' : 'Download'}
          </Button>
        </div>
      ))}
      {engine.listTranslationPacks().map((pack) => (
        <div key={pack.id} className="pn-dict-settings__row">
          <strong>{pack.name}</strong>
          <span className="pn-dict-settings__meta">
            {formatBytes(pack.sizeBytes)} · {pack.license}
            {engine.isTranslationReady(pack.id) ? ' · On device' : ''}
          </span>
          <Button
            variant="secondary"
            disabled={busy === pack.id || engine.isTranslationReady(pack.id)}
            onClick={() => void install(pack.id, () => engine.ensureTranslationPack(pack.id))}
          >
            {engine.isTranslationReady(pack.id) ? 'Installed' : busy === pack.id ? 'Downloading…' : 'Download'}
          </Button>
        </div>
      ))}
    </section>
  );
}
