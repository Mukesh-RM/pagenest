import { useEffect, useRef, type ReactNode } from 'react';
import { AppMark } from '../components/AppMark';
import { Button } from '../components/Button';
import { Illustration } from '../components/Illustration';
import { StarterBookCard, type StarterBookOffer } from '../components/StarterBookCard';
import { Icon, type IconName } from '../icons';
import { cx } from '../utils/cx';
import '../styles/screens.css';
import '../styles/surfaces.css';

export const ONBOARDING_STEP_COUNT = 3;

export interface OnboardingScreenProps {
  /** 0, 1 or 2. */
  step: number;
  onNext: () => void;
  onBack: () => void;
  /** Skip all cards (offered on the first two). */
  onSkip: () => void;
  /** Finish on the last card. */
  onDone: () => void;
  /** A real bundled public-domain book, shown on card 2. Leave out when the app has none. */
  starter?: StarterBookOffer;
  /** "Add your book" on card 2 (opens the file picker). Leave out until adding files works. */
  onAddBooks?: () => void;
  /** Card 3: the look controls (theme picker, text size, a live sample). Owned by the app, which saves them. */
  look: ReactNode;
}

const PROMISES: ReadonlyArray<{ icon: IconName; title: string; text: string }> = [
  { icon: 'lock', title: 'Private by design', text: 'Your books and your place in them stay on this device.' },
  { icon: 'wifiOff', title: 'Works offline', text: 'After the first load, no connection is needed.' },
  { icon: 'sparkles', title: 'Nothing to sign up for', text: 'No account, no ads and no tracking.' },
];

const HOME: ReadonlyArray<{ icon: IconName; text: string }> = [
  { icon: 'folder', text: 'Books, PDFs and audiobooks are saved in private storage on this device.' },
  { icon: 'wifiOff', text: 'After the first load, InkQuiet works without internet.' },
  { icon: 'lock', text: 'Nothing you add is ever uploaded.' },
];

/**
 * First-run onboarding in three cards (blueprint 5.6): Welcome, a home for your books (with the sample book and
 * "Add your book"), and Pick a look. Presentational: the app owns the step and saves theme and text size.
 * Every card has a designed picture, the actions are anchored to the bottom of the screen, and no card has an
 * empty area. Focus moves to the card's heading when the step changes.
 */
export function OnboardingScreen({ step, onNext, onBack, onSkip, onDone, starter, onAddBooks, look }: OnboardingScreenProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const last = step >= ONBOARDING_STEP_COUNT - 1;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);
  return (
    <main className="pn-onb">
      <header className="pn-onb__top">
        <p className="pn-onb__step" id="pn-onb-step">
          Step {step + 1} of {ONBOARDING_STEP_COUNT}
        </p>
        <span className="pn-onb__dots" aria-hidden="true">
          {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, i) => (
            <span key={i} className={cx('pn-onb__dot', i === step && 'pn-onb__dot--current')} />
          ))}
        </span>
        {last ? (
          <span className="pn-onb__skip-space" aria-hidden="true" />
        ) : (
          <Button variant="ghost" onClick={onSkip}>
            Skip
          </Button>
        )}
      </header>

      <section className="pn-onb__card" aria-describedby="pn-onb-step">
        {step === 0 ? (
          <>
            <div className="pn-onb__hero pn-onb__hero--mark">
              <AppMark size={112} />
            </div>
            <div className="pn-onb__content">
            <h1 ref={heading} tabIndex={-1} className="pn-onb__title">
              Your books, your voice, no account.
            </h1>
            <p className="pn-onb__lead">InkQuiet keeps everything on this device. There is no sign-in, no ads and no tracking.</p>
            <ul className="pn-onb__promises">
              {PROMISES.map((p) => (
                <li key={p.title} className="pn-onb__promise">
                  <span className="pn-onb__promise-icon" aria-hidden="true">
                    <Icon name={p.icon} size={20} />
                  </span>
                  <span className="pn-onb__promise-text">
                    <span className="pn-onb__promise-title">{p.title}</span>
                    <span className="pn-onb__promise-body">{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            </div>
          </>
        ) : step === 1 ? (
          <>
            <div className="pn-onb__hero pn-onb__hero--art">
              <Illustration name="shelf" />
            </div>
            <div className="pn-onb__content">
            <h1 ref={heading} tabIndex={-1} className="pn-onb__title">
              A home for your books
            </h1>
            <ul className="pn-onb__list">
              {HOME.map((h) => (
                <li key={h.text} className="pn-onb__list-item">
                  <span className="pn-onb__list-icon" aria-hidden="true">
                    <Icon name={h.icon} size={20} />
                  </span>
                  <span>{h.text}</span>
                </li>
              ))}
            </ul>
            {starter ? <StarterBookCard offer={starter} /> : null}
            {onAddBooks ? (
              <Button variant={starter ? 'secondary' : 'primary'} icon="filePlus" onClick={onAddBooks}>
                Add your book
              </Button>
            ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="pn-onb__hero pn-onb__hero--art">
              <Illustration name="done" />
            </div>
            <div className="pn-onb__content">
            <h1 ref={heading} tabIndex={-1} className="pn-onb__title">
              Pick a look
            </h1>
            <div className="pn-onb__look">{look}</div>
            </div>
          </>
        )}
      </section>

      <footer className="pn-onb__footer">
        {step > 0 ? (
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {last ? <Button onClick={onDone}>Done</Button> : <Button onClick={onNext}>Next</Button>}
      </footer>
    </main>
  );
}

export default OnboardingScreen;
