import { useEffect, useState } from 'react';
import { formatBytes, getStorageStatus, requestPersistentStorage, type StorageStatus } from '@/data/storage';
import { PageHeader } from '../components/PageHeader';
import { useServices } from '../services-context';
import { useSettings } from '../settings-store';
import { THEME_LABELS, THEME_PREFERENCES } from '../themes';

/** Settings: Appearance and Storage today; the other groups from blueprint 5.6 arrive with their features. */
export function SettingsPage() {
  const { db } = useServices();
  const preference = useSettings((s) => s.themePreference);
  const setPreference = useSettings((s) => s.setThemePreference);
  const [storage, setStorage] = useState<StorageStatus | undefined>();

  useEffect(() => {
    let active = true;
    void getStorageStatus().then((s) => {
      if (active) setStorage(s);
    });
    return () => {
      active = false;
    };
  }, []);

  async function keepMyData(): Promise<void> {
    await requestPersistentStorage();
    setStorage(await getStorageStatus());
  }

  return (
    <>
      <PageHeader title="Settings" />

      <section aria-labelledby="appearance" className="mb-8">
        <h2 id="appearance" className="mb-2 text-xl font-semibold">
          Appearance
        </h2>
        <div role="radiogroup" aria-label="App theme" className="flex flex-wrap gap-2">
          {THEME_PREFERENCES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={preference === option}
              onClick={() => void setPreference(db, option)}
              className={`min-h-touch rounded-full border px-4 font-medium ${
                preference === option ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink'
              }`}
            >
              {THEME_LABELS[option]}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="storage" className="mb-8">
        <h2 id="storage" className="mb-2 text-xl font-semibold">
          Storage used
        </h2>
        {storage === undefined ? (
          <p className="text-muted">Checking…</p>
        ) : (
          <>
            <p>
              {storage.usageBytes === undefined
                ? 'Your browser does not say how much space PageNest uses.'
                : `PageNest uses ${formatBytes(storage.usageBytes)}${
                    storage.quotaBytes === undefined ? '.' : ` of about ${formatBytes(storage.quotaBytes)} available.`
                  }`}
            </p>
            {storage.persisted === true ? (
              <p className="text-muted">Your browser will keep your books and progress.</p>
            ) : storage.persisted === false ? (
              <>
                <p className="mb-2 text-muted">
                  Your browser may clear your books if space runs low. Asking it to keep them helps.
                </p>
                <button
                  type="button"
                  onClick={() => void keepMyData()}
                  className="min-h-touch rounded-full bg-accent px-5 font-medium text-on-accent"
                >
                  Keep my data
                </button>
              </>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="about">
        <h2 id="about" className="mb-2 text-xl font-semibold">
          About
        </h2>
        <p className="text-muted">
          PageNest collects nothing. Your books, notes and settings stay on this device. There is no account, no ads and
          no tracking.
        </p>
      </section>
    </>
  );
}
