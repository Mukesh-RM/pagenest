import { Sheet } from './Sheet';

/**
 * How to put PageNest on the home screen (blueprint 5.6, "Install and first
 * launch"). Opened from Settings at any time. Plain words, no tracking.
 */
export function InstallHelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Install help">
      <p className="mb-4 text-muted">
        Installed, PageNest opens full screen with its own icon, keeps playing with the screen off, and your books are
        safer from being cleared.
      </p>
      <h3 className="mb-2 font-semibold">iPhone and iPad (Safari)</h3>
      <ol className="mb-4 list-decimal space-y-2 pl-6">
        <li>Tap the Share button.</li>
        <li>Tap Add to Home Screen.</li>
        <li>Tap Add.</li>
      </ol>
      <h3 className="mb-2 font-semibold">Android (Chrome)</h3>
      <p className="mb-6">Open the browser menu and choose Install app, or Add to Home screen.</p>
      <button
        type="button"
        onClick={onClose}
        className="min-h-touch w-full rounded-full bg-accent px-5 font-medium text-on-accent"
      >
        Done
      </button>
    </Sheet>
  );
}
