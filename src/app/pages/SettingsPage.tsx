import { useEffect, useState } from 'react';
import { formatBytes, getStorageStatus, requestPersistentStorage, type StorageStatus } from '@/data/storage';
import { Button, InstallHelp } from '@/ui';
import { FontSizeControl } from '../components/FontSizeControl';
import { PageHeader, Screen, SectionHeading } from '../components/PageHeader';
import { ThemeSwatches } from '../components/ThemeSwatches';

/** Settings: Appearance, Install help and Storage today; the other groups from blueprint 5.6 arrive with their features. */
export function SettingsPage() {
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
    <Screen>
      <PageHeader title="Settings" />

      <section aria-labelledby="appearance" className="flex flex-col gap-3">
        <SectionHeading id="appearance">Appearance</SectionHeading>
        <ThemeSwatches />
        <div className="max-w-sm">
          <FontSizeControl />
        </div>
      </section>

      <section aria-labelledby="install" className="flex flex-col gap-3">
        <SectionHeading id="install">Install help</SectionHeading>
        <p className="text-muted">
          Put PageNest on your home screen so it opens like an app. On Android, open the browser menu and choose Install
          app, or Add to Home screen.
        </p>
        <InstallHelp />
      </section>

      <section aria-labelledby="storage" className="flex flex-col gap-3">
        <SectionHeading id="storage">Storage used</SectionHeading>
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
                <p className="text-muted">Your browser may clear your books if space runs low. Asking it to keep them helps.</p>
                <Button onClick={() => void keepMyData()}>Keep my data</Button>
              </>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="about" className="flex flex-col gap-3">
        <SectionHeading id="about">About</SectionHeading>
        <p className="text-muted">
          PageNest collects nothing. Your books, notes and settings stay on this device. There is no account, no ads and no tracking.
        </p>
      </section>
    </Screen>
  );
}
