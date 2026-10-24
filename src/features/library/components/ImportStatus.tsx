import { useState } from 'react';
import { BottomSheet, Button, ProgressBar } from '@/ui';
import { useImportController, useImportState } from '../context';

/** "Adding 12 of 40", then "Added 38 books", with the files that could not be added listed in plain words. */
export function ImportStatus() {
  const controller = useImportController();
  const run = useImportState((s) => s.run);
  const [details, setDetails] = useState(false);
  if (!run) return null;
  const { active, total, done, added, duplicates, problems } = run;
  const word = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

  let summary: string;
  if (active) summary = `Adding ${Math.min(done, total)} of ${total}`;
  else {
    const parts = [added > 0 ? `Added ${word(added, 'book', 'books')}` : 'Nothing new was added'];
    if (duplicates > 0) parts.push(`${word(duplicates, 'was', 'were')} already in your library`);
    if (problems.length > 0) parts.push(`${word(problems.length, 'file', 'files')} could not be added`);
    summary = parts.join('. ') + '.';
  }
  return (
    <>
      <div className="pn-lib-status" role="status" aria-live="polite">
        <div className="pn-lib-status__text">
          <span>{summary}</span>
          {active ? <ProgressBar value={total === 0 ? 0 : done / total} label="Import progress" /> : null}
        </div>
        {active ? (
          <Button variant="ghost" onClick={() => controller.cancelImport()}>
            Stop
          </Button>
        ) : (
          <>
            {problems.length > 0 ? (
              <Button variant="secondary" onClick={() => setDetails(true)}>
                See why
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => controller.dismissRun()}>
              Dismiss
            </Button>
          </>
        )}
      </div>
      <BottomSheet open={details} onClose={() => setDetails(false)} title="Files that could not be added">
        <ul className="pn-lib-problems">
          {problems.map((p, i) => (
            <li key={i}>
              {p.name ? <strong className="pn-lib-problems__name">{p.name}</strong> : null}
              <span>{p.message}</span>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}
