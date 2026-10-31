import type { ReactNode } from 'react';
import { Button } from './Button';
import { Illustration } from './Illustration';
import { StarterBookCard, type StarterBookOffer } from './StarterBookCard';
import { cx } from '../utils/cx';

export interface FirstRunBooksProps {
  /** Opens the file picker. */
  onAdd?: () => void;
  /** More actions below the buttons (the app's own, for example "Import a folder"). */
  extra?: ReactNode;
  /** A real bundled public-domain book (the app's own). Leave out when the app has none: the card is then simply not shown. */
  starter?: StarterBookOffer;
  className?: string;
}

/**
 * The first-run path for an empty library: a welcome, the sample book (when the app has one) and "Add your book".
 * The first book opens within two taps and 30 seconds, with no account. Used by LibraryScreen and by onboarding.
 */
export function FirstRunBooks({ onAdd, starter, extra, className }: FirstRunBooksProps) {
  return (
    <section aria-labelledby="pn-firstrun-title" className={cx('pn-firstrun', className)}>
      <Illustration name="books" className="pn-firstrun__art" />
      <h2 id="pn-firstrun-title" className="pn-firstrun__title">
        Your shelf is waiting
      </h2>
      <p className="pn-firstrun__text">Add a book from this device, or open the sample to see how InkQuiet reads. Everything stays on this device.</p>
      {starter ? <StarterBookCard offer={starter} /> : null}
      {onAdd ? (
        <Button variant={starter ? 'secondary' : 'primary'} icon="filePlus" onClick={onAdd}>
          Add your book
        </Button>
      ) : null}
      {extra}
    </section>
  );
}
