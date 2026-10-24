import { useEffect, useRef, useState } from 'react';
import type { ImportResult, SampleBookProvider } from '@/app/contracts';
import { Button, Card } from '@/ui';

type Phase = { name: 'idle' } | { name: 'busy' } | { name: 'error'; message: string };

const FALLBACK_ERROR = 'Could not add the sample book. Please try again.';

/**
 * "Try a sample book" for an empty Library. Render it only for a provider that is registered and
 * `available()`; the Library does that check, so this card never shows a button that cannot work.
 *
 * The card keeps one height in every state (the status line below the button is always reserved),
 * and the button keeps one width, so nothing moves when it starts, fails or succeeds.
 */
export function SampleBookCard({
  provider,
  onImported,
}: {
  provider: SampleBookProvider;
  /**
   * Called when the sample was added. The card may already be gone by then (a new book makes the
   * Library stop being empty), so the caller decides whether to open the book.
   */
  onImported: (result: ImportResult) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const mounted = useRef(true);
  const running = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function add(): void {
    if (running.current) return; // a double tap must not import twice
    running.current = true;
    setPhase({ name: 'busy' });
    provider.importSample().then(
      (result) => {
        running.current = false;
        onImported(result);
      },
      (error: unknown) => {
        running.current = false;
        const message = error instanceof Error && error.message.trim() ? error.message : FALLBACK_ERROR;
        if (mounted.current) setPhase({ name: 'error', message });
      },
    );
  }

  const { info } = provider;
  const busy = phase.name === 'busy';
  return (
    <section aria-label="Try a sample book" className="mx-auto mt-4 w-full max-w-sm">
      <Card>
        <div className="flex min-h-[208px] flex-col gap-2 p-4">
          <h3 className="font-semibold">Try a sample book</h3>
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">{info.title}</span> by {info.author}. {info.license}. {info.provenance}.
          </p>
          <Button block variant="secondary" disabled={busy} aria-busy={busy} onClick={add}>
            {busy ? 'Adding…' : phase.name === 'error' ? 'Try again' : 'Add the sample book'}
          </Button>
          <p role="status" aria-live="polite" className="min-h-[24px] text-sm text-muted">
            {busy ? 'Adding to your library…' : phase.name === 'error' ? phase.message : ''}
          </p>
        </div>
      </Card>
    </section>
  );
}
