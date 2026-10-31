import '../sync.css';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, ProgressBar } from '@/ui';
import { generatePairingCode } from '@/features/sync/pairing-code';
import type { SyncImportResult } from '@/workers/sync/protocol';
import { getSyncClient } from '../registry';

const SyncWirelessPanel = lazy(() => import('./SyncWirelessPanel').then((m) => ({ default: m.SyncWirelessPanel })));

type Mode = 'file-export' | 'file-import' | 'qr-send' | 'qr-receive' | 'webrtc-send' | 'webrtc-receive';
type Status = { kind: 'idle' } | { kind: 'busy'; label: string; value: number } | { kind: 'done'; message: string } | { kind: 'error'; message: string };

const MODES: { id: Mode; label: string }[] = [
  { id: 'file-export', label: 'Export file' },
  { id: 'file-import', label: 'Import file' },
  { id: 'qr-send', label: 'Show QR' },
  { id: 'qr-receive', label: 'Scan QR' },
  { id: 'webrtc-send', label: 'Send direct' },
  { id: 'webrtc-receive', label: 'Receive direct' },
];

function summaryMessage(result: SyncImportResult): string {
  if (result.kind === 'full') {
    return `Synced ${result.restore.booksAdded} new book(s) and merged notes and progress.`;
  }
  const m = result.merge;
  const parts = [
    m.progressMerged ? `${m.progressMerged} progress` : '',
    m.highlightsMerged ? `${m.highlightsMerged} highlights` : '',
    m.bookmarksMerged ? `${m.bookmarksMerged} bookmarks` : '',
  ].filter(Boolean);
  return parts.length ? `Merged ${parts.join(', ')}.` : 'Already up to date on this device.';
}

const wirelessModes = new Set<Mode>(['qr-send', 'qr-receive', 'webrtc-send', 'webrtc-receive']);

/** Settings → Sync devices: encrypted export/import, animated QR, optional WebRTC with STUN-only signaling via QR. */
export function SyncDevicesPanel() {
  const [mode, setMode] = useState<Mode>('file-export');
  const [includeFiles, setIncludeFiles] = useState(false);
  const [pairingCode, setPairingCode] = useState(() => generatePairingCode());
  const [enteredCode, setEnteredCode] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = status.kind === 'busy';

  const refreshCode = useCallback(() => {
    setPairingCode(generatePairingCode());
    setEnteredCode('');
  }, []);

  useEffect(() => {
    if (!wirelessModes.has(mode)) return;
    refreshCode();
  }, [mode, refreshCode]);

  async function exportFile(): Promise<void> {
    setStatus({ kind: 'busy', label: 'Encrypting', value: 0 });
    try {
      const { blob, fileName } = await getSyncClient().run<{ blob: Blob; fileName: string; pairingCode: string }>(
        { type: 'sync-export-file', code: pairingCode, includeFiles },
        (e) => {
          if (e.type === 'progress') setStatus({ kind: 'busy', label: e.stage, value: e.total > 0 ? e.done / e.total : 0 });
        },
      ).done;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus({ kind: 'done', message: 'Sync file saved. Enter the pairing code on the other device.' });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Export failed.' });
    }
  }

  async function importFile(file: File): Promise<void> {
    setStatus({ kind: 'busy', label: 'Merging', value: 0 });
    try {
      const result = await getSyncClient().run<SyncImportResult>({ type: 'sync-import-file', file, code: enteredCode || pairingCode }, (e) => {
        if (e.type === 'progress') setStatus({ kind: 'busy', label: e.stage, value: e.total > 0 ? e.done / e.total : 0 });
      }).done;
      setStatus({ kind: 'done', message: summaryMessage(result) });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Import failed.' });
    }
  }

  const modeButtons = useMemo(
    () =>
      MODES.map((m) => (
        <Button key={m.id} variant={mode === m.id ? 'primary' : 'secondary'} onClick={() => setMode(m.id)} disabled={busy}>
          {m.label}
        </Button>
      )),
    [mode, busy],
  );

  return (
    <section className="pn-lib-panel pn-sync-panel" aria-labelledby="pn-sync-title">
      <h2 id="pn-sync-title">Sync devices</h2>
      <p>
        Move your library metadata, progress, bookmarks, highlights, notes, collections and settings to another phone or tablet. No account and no server — everything is
        encrypted with a one-time code you read aloud.
      </p>

      <div className="pn-sync-code" data-testid="sync-pairing-code">
        <span className="pn-sync-code__label">Pairing code</span>
        <span className="pn-sync-code__value">{pairingCode}</span>
        <Button variant="secondary" onClick={refreshCode} disabled={busy}>
          New code
        </Button>
      </div>

      <label className="pn-sync-check">
        <input type="checkbox" checked={includeFiles} onChange={(e) => setIncludeFiles(e.target.checked)} disabled={busy || mode === 'qr-send'} />
        <span>Include book files (larger; uses a sync file or direct transfer)</span>
      </label>

      <div className="pn-sync-modes">{modeButtons}</div>

      {(mode === 'file-import' || wirelessModes.has(mode)) && (
        <div className="pn-sync-field">
          <label htmlFor="pn-sync-enter-code">Code from the other device</label>
          <input
            id="pn-sync-enter-code"
            data-testid="sync-enter-code"
            value={enteredCode}
            onChange={(e) => setEnteredCode(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Enter code"
          />
        </div>
      )}

      {mode === 'file-export' ? (
        <Button block icon="download" disabled={busy} onClick={() => void exportFile()}>
          Save sync file
        </Button>
      ) : null}
      {mode === 'file-import' ? (
        <>
          <Button block variant="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
            Choose sync file
          </Button>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept=".pnsync,application/json"
            data-testid="sync-file-input"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (file) void importFile(file);
            }}
          />
        </>
      ) : null}

      {wirelessModes.has(mode) ? (
        <Suspense fallback={<p className="pn-sync-status">Loading camera or QR…</p>}>
          <SyncWirelessPanel mode={mode as 'qr-send' | 'qr-receive' | 'webrtc-send' | 'webrtc-receive'} pairingCode={pairingCode} enteredCode={enteredCode} busy={busy} onStatus={setStatus} />
        </Suspense>
      ) : null}

      <div role="status" aria-live="polite" className="pn-sync-status">
        {status.kind === 'busy' ? (
          <>
            <span>{status.label}</span>
            <ProgressBar value={status.value} label={status.label} />
          </>
        ) : null}
        {status.kind === 'done' ? <span>{status.message}</span> : null}
      </div>
      {status.kind === 'error' ? (
        <p role="alert" className="pn-sync-error">
          {status.message}
        </p>
      ) : null}
    </section>
  );
}
