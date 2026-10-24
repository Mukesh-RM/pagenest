import { BackupRestorePanel, StoragePanel } from '@/features/library';

/** The Library's Settings groups: Backup and restore, and what takes space on this device (with Free up space). */
export function LibrarySettingsPanels() {
  return (
    <>
      <BackupRestorePanel />
      <StoragePanel />
    </>
  );
}
