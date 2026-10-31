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
const DictionarySettingsPanel = lazy(() =>
  import('@/features/dictionary/DictionarySettingsPanel').then((m) => ({ default: m.DictionarySettingsPanel })),
);
const VoiceStudioSettingsPanel = lazy(() =>
  import('../components/VoiceStudioSettingsPanel').then((m) => ({ default: m.VoiceStudioSettingsPanel })),
);

/**
 * Height kept for the Library's two groups only while their code loads (in `rem`, so it follows the text
 * size), so the About group below does not move.
 */
const PANELS_RESERVE_REM = 36; // measured: 36.9 rem at 360 px wide, 33 rem at 1024 px, 38 rem at 200 % text

function usageText(storage: StorageStatus): string {
  if (storage.usageBytes === undefined) return 'Your browser does not say how much space InkQuiet uses.';
  const used = `InkQuiet uses ${formatBytes(storage.usageBytes)}`;
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
  const contrastMode = useSettings((s) => s.contrastMode);
  const setContrast = useSettings((s) => s.setContrastMode);
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
      contrastMode={contrastMode}
      onContrastModeChange={(mode) => void setContrast(db, mode)}
      textSize={textSize}
      onTextSizeChange={(px) => void setSize(db, clampFontSize(px))}
      install={<InstallHelp />}
      storage={storage}
    >
      <Suspense fallback={<div aria-hidden="true" style={{ height: `${PANELS_RESERVE_REM}rem` }} />}>
        <VoiceStudioSettingsPanel />
      </Suspense>
      <Suspense fallback={<div aria-hidden="true" style={{ height: '14rem' }} />}>
        <DictionarySettingsPanel />
      </Suspense>
      <Suspense fallback={<div aria-hidden="true" style={{ height: `${PANELS_RESERVE_REM}rem` }} />}>
        <LibrarySettingsPanels />
      </Suspense>
    </SettingsScreen>
  );
}
