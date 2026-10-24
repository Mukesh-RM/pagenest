import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { formatBytes, getStorageStatus, requestPersistentStorage, type StorageStatus } from '@/data/storage';
import { InstallHelp } from '@/ui';
import { SettingsScreen, type SettingsStorage } from '@/ui/screens';
import type { CustomThemeInput } from '@/ui/theme/custom';
import { clampFontSize } from '../font-size';
import { useServices } from '../services-context';
import { useSettings } from '../settings-store';
import type { ThemePreference } from '../themes';
import '../screen-styles';

// Backup, restore and the storage breakdown come from the Library; they are loaded with the screen, not with the app shell.
const LibrarySettingsPanels = lazy(() => import('../components/LibrarySettingsPanels').then((m) => ({ default: m.LibrarySettingsPanels })));

/**
 * Height kept for the Library's two groups while their code loads (in `rem`, so it follows the text
 * size), so the About group below does not move.
 */
const PANELS_RESERVE_REM = 26;

function usageText(storage: StorageStatus): string {
  if (storage.usageBytes === undefined) return 'Your browser does not say how much space PageNest uses.';
  const used = `PageNest uses ${formatBytes(storage.usageBytes)}`;
  return storage.quotaBytes === undefined ? `${used}.` : `${used} of about ${formatBytes(storage.quotaBytes)} available.`;
}

/**
 * Settings: the design system's `SettingsScreen` (Appearance with theme cards, Custom colors and text
 * size to 200 %, Install help, Storage used, About) bound to the saved settings, plus the Library's
 * Backup and restore and Storage on this device groups between Storage and About.
 */
export function SettingsPage() {
  const { db } = useServices();
  const theme = useSettings((s) => s.themePreference);
  const customTheme = useSettings((s) => s.customTheme);
  const textSize = useSettings((s) => s.fontSizePx);
  const setTheme = useSettings((s) => s.setThemePreference);
  const setCustom = useSettings((s) => s.setCustomTheme);
  const setSize = useSettings((s) => s.setFontSizePx);
  const [status, setStatus] = useState<StorageStatus | undefined>();

  useEffect(() => {
    let active = true;
    void getStorageStatus().then((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, []);

  const keepMyData = useCallback(async () => {
    await requestPersistentStorage();
    setStatus(await getStorageStatus());
  }, []);

  const storage: SettingsStorage | undefined =
    status === undefined
      ? undefined
      : {
          usageText: usageText(status),
          ...(status.persisted === undefined ? {} : { persisted: status.persisted }),
          onKeepData: () => void keepMyData(),
        };

  return (
    <SettingsScreen
      theme={theme}
      onThemeChange={(value: ThemePreference) => void setTheme(db, value)}
      customTheme={customTheme}
      onCustomThemeChange={(colors: CustomThemeInput) => void setCustom(db, colors)}
      textSize={textSize}
      onTextSizeChange={(px) => void setSize(db, clampFontSize(px))}
      install={<InstallHelp />}
      storage={storage}
    >
      <div style={{ minHeight: `${PANELS_RESERVE_REM}rem` }}>
        <Suspense fallback={null}>
          <LibrarySettingsPanels />
        </Suspense>
      </div>
    </SettingsScreen>
  );
}
