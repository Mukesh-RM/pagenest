import { useEffect, useRef, useState } from 'react';
import { Button } from '@/ui';
import { FontSizeControl } from '../components/FontSizeControl';
import { ThemeSwatches } from '../components/ThemeSwatches';
import { useServices } from '../services-context';
import { useSettings } from '../settings-store';

/** Number of onboarding cards (blueprint 5.6: three cards, skippable). */
export const ONBOARDING_STEPS = 3;

const PREVIEW_TEXT =
  'Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, I thought I would sail about a little and see the watery part of the world.';

const HEADING = 'mb-3 text-[length:var(--pn-text-xl)] font-semibold leading-tight outline-none';

/**
 * First-run onboarding (blueprint 5.6): Welcome, where your books will live,
 * then Pick a look. Theme and text size are saved as you choose, so Skip and
 * Done both keep them. Both mark onboarding finished, and it is never shown
 * again. Each card moves focus to its heading so keyboard and screen-reader
 * users start at the top of the new card.
 */
export function Onboarding() {
  const { db } = useServices();
  const complete = useSettings((s) => s.completeOnboarding);
  const fontSizePx = useSettings((s) => s.fontSizePx);
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const last = step === ONBOARDING_STEPS - 1;

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  const finish = (): void => void complete(db);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-[calc(1rem+var(--pn-safe-bottom))] pt-[calc(1rem+var(--pn-safe-top))]">
      <div className="flex min-h-touch items-center justify-between">
        <p className="text-muted" id="onboarding-step">
          Step {step + 1} of {ONBOARDING_STEPS}
        </p>
        {last ? null : (
          <Button variant="ghost" onClick={finish}>
            Skip
          </Button>
        )}
      </div>

      <section aria-describedby="onboarding-step" className="flex-1 py-6">
        {step === 0 ? (
          <>
            <h1 ref={heading} tabIndex={-1} className={HEADING}>
              Your books, your voice, no account.
            </h1>
            <p className="text-muted">
              PageNest keeps everything on this device. There is no sign-in, no ads and no tracking.
            </p>
          </>
        ) : step === 1 ? (
          <>
            <h1 ref={heading} tabIndex={-1} className={HEADING}>
              A home for your books
            </h1>
            <ul className="mb-4 list-disc space-y-2 pl-6">
              <li>Books, PDFs and audiobooks will be saved in private storage on this phone.</li>
              <li>After the first load, PageNest works without internet.</li>
              <li>Nothing you add is ever uploaded.</li>
            </ul>
            <p className="rounded-card bg-surface p-4">
              Adding books arrives in the next release. For now, choose how PageNest looks.
            </p>
          </>
        ) : (
          <>
            <h1 ref={heading} tabIndex={-1} className={`${HEADING} mb-4`}>
              Pick a look
            </h1>
            <div className="mb-6">
              <ThemeSwatches />
            </div>
            <div className="mb-4">
              <FontSizeControl />
            </div>
            <p
              data-testid="font-preview"
              className="rounded-card bg-surface p-4 leading-relaxed"
              style={{ fontSize: `${fontSizePx}px` }}
            >
              {PREVIEW_TEXT}
            </p>
          </>
        )}
      </section>

      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {last ? (
          <Button onClick={finish}>Done</Button>
        ) : (
          <Button onClick={() => setStep(step + 1)}>Next</Button>
        )}
      </div>
    </main>
  );
}
