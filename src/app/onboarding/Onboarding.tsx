import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SampleBookInfo } from '@/app/contracts';
import { useSnackbar } from '@/ui';
import { OnboardingScreen, ONBOARDING_STEP_COUNT, type StarterBookOffer } from '@/ui/screens';
import { FontSizeControl } from '../components/FontSizeControl';
import { ThemeSwatches } from '../components/ThemeSwatches';
import { pathForBook } from '../route-paths';
import { useServices } from '../services-context';
import { useSettings } from '../settings-store';
import '../screen-styles';

/** Number of onboarding cards (blueprint 5.6: three cards, skippable). */
export const ONBOARDING_STEPS = ONBOARDING_STEP_COUNT;

const PREVIEW_TEXT =
  'Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, I thought I would sail about a little and see the watery part of the world.';

/**
 * First-run onboarding (blueprint 5.6) on the design system's `OnboardingScreen`: Welcome, a home for
 * your books (the sample book and "Add your book" when the Library provider can run), then Pick a
 * look. Theme and text size are saved as you choose, so Skip and Done both keep them. Both mark
 * onboarding finished, and it is never shown again.
 */
export function Onboarding() {
  const { db, sampleBook, importer } = useServices();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const complete = useSettings((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const running = useRef(false);
  const mounted = useRef(true);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The design system moves focus to a card's heading when the step changes; on arrival, start at the first heading too.
  useEffect(() => {
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, []);

  const finish = useCallback(() => void complete(db), [complete, db]);

  // The sample book is the fastest way in: finish onboarding and open it.
  const openSample = useCallback(() => {
    if (!sampleBook || running.current) return; // a double tap must not import twice
    running.current = true;
    setBusy(true);
    setError(undefined);
    sampleBook.importSample().then(
      (result) => {
        running.current = false;
        void complete(db);
        navigate(pathForBook({ id: result.bookId, kind: result.kind }), { replace: true });
      },
      (e: unknown) => {
        running.current = false;
        if (!mounted.current) return;
        setBusy(false);
        setError(e instanceof Error && e.message.trim() ? e.message : 'Could not add the sample book. Please try again.');
      },
    );
  }, [sampleBook, complete, db, navigate]);

  const info: SampleBookInfo | undefined = sampleBook?.available() ? sampleBook.info : undefined;
  const starter: StarterBookOffer | undefined = info
    ? { title: info.title, author: info.author, license: info.license, provenance: info.provenance, busy, ...(error ? { error } : {}), onOpen: openSample }
    : undefined;

  // "Add your book": the system file picker, then the Library with the new book.
  const canAdd = importer?.available() === true;
  const onFiles = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = [...(event.target.files ?? [])];
      event.target.value = '';
      if (!importer || files.length === 0) return;
      importer.importFiles(files).then(
        (outcomes) => {
          const added = outcomes.some((o) => 'result' in o);
          const failed = outcomes.find((o): o is Extract<typeof o, { error: string }> => 'error' in o);
          if (added) {
            void complete(db);
            navigate('/', { replace: true });
          } else {
            snackbar.show({ message: failed?.error ?? 'Nothing was added. Please try again.' });
          }
        },
        () => snackbar.show({ message: 'Nothing was added. Please try again.' }),
      );
    },
    [importer, complete, db, navigate, snackbar],
  );

  return (
    <>
      <OnboardingScreen
        step={step}
        onNext={() => setStep((s) => Math.min(ONBOARDING_STEPS - 1, s + 1))}
        onBack={() => setStep((s) => Math.max(0, s - 1))}
        onSkip={finish}
        onDone={finish}
        {...(starter ? { starter } : {})}
        {...(canAdd ? { onAddBooks: () => picker.current?.click() } : {})}
        look={
          <>
            <ThemeSwatches />
            <FontSizeControl />
            <p data-testid="font-preview" className="pn-set-card__sample">
              {PREVIEW_TEXT}
            </p>
          </>
        }
      />
      {importer ? <input ref={picker} type="file" multiple accept={importer.accept} tabIndex={-1} aria-hidden="true" className="sr-only" onChange={onFiles} /> : null}
    </>
  );
}
