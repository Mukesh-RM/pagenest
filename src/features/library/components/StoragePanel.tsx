import { useCallback, useEffect, useState } from 'react';
import { formatBytes } from '@/data/storage';
import { Button } from '@/ui';
import type { StorageBreakdown } from '@/workers/import/protocol';
import { getImportClient } from '../registry';

/** What takes space on this device, by kind, and a button that frees what can be made again. Settings screen. */
export function StoragePanel() {
  const [usage, setUsage] = useState<StorageBreakdown | undefined>();
  const [problem, setProblem] = useState<string | undefined>();
  const [freed, setFreed] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    try {
      setUsage(await getImportClient().run<StorageBreakdown>({ type: 'usage' }).done);
      setProblem(undefined);
    } catch {
      setProblem('Storage use could not be read right now.');
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function free(): Promise<void> {
    try {
      const { removed } = await getImportClient().run<{ removed: number }>({ type: 'clear-caches' }).done;
      setFreed(removed > 0 ? `Freed ${formatBytes(removed)}.` : 'Nothing to free.');
      await refresh();
    } catch {
      setProblem('That could not be done. Please try again.');
    }
  }
  const rows: [string, number | undefined][] = [
    ['Books and documents', usage?.books],
    ['Audiobooks', usage?.audio],
    ['Covers', usage?.covers],
    ['Voices', usage?.voices],
    ['Narrated chapters (can be made again)', usage?.caches],
  ];
  return (
    <section className="pn-lib-panel" aria-labelledby="pn-storage-title">
      <h2 id="pn-storage-title">Storage on this device</h2>
      <dl className="pn-lib-breakdown">
        {rows.map(([label, bytes]) => (
          <div key={label} style={{ display: 'contents' }}>
            <dt>{label}</dt>
            <dd>{bytes === undefined ? '…' : formatBytes(bytes)}</dd>
          </div>
        ))}
      </dl>
      <Button variant="secondary" block disabled={!usage || usage.caches === 0} onClick={() => void free()}>
        Free up space
      </Button>
      <p role="status">{freed ?? ''}</p>
      {problem ? (
        <p role="alert" className="pn-lib-error">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
