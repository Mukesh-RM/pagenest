import { Button } from './Button';
import { BookCover } from './BookCover';
import { cx } from '../utils/cx';

/** A real, bundled public-domain book the person can open right away. The app provides it; nothing here is made up. */
export interface StarterBookOffer {
  title: string;
  author: string;
  /** Plain words, for example "Public domain". */
  license: string;
  /** Where the text came from, for example "Project Gutenberg, ebook 1342". */
  provenance: string;
  /** Cover image, if the book has one. Otherwise a title card is generated from the title. */
  coverUrl?: string;
  /** The sample is being added. */
  busy?: boolean;
  /** Plain-word message when adding failed. */
  error?: string;
  /** Add the book and open it. */
  onOpen: () => void;
}

export interface StarterBookCardProps {
  offer: StarterBookOffer;
  className?: string;
}

/**
 * "Open a sample book": cover, title, author and where the book comes from, with one button. The status line is
 * always in the layout, so the card never changes height while it adds the book or reports a problem.
 */
export function StarterBookCard({ offer, className }: StarterBookCardProps) {
  return (
    <section aria-label="Try a sample book" className={cx('pn-sample', className)}>
      <div className="pn-sample__cover" aria-hidden="true">
        <BookCover title={offer.title} author={offer.author} src={offer.coverUrl} eager />
      </div>
      <div className="pn-sample__body">
        <p className="pn-sample__kicker">Try a sample book</p>
        <h3 className="pn-sample__title">{offer.title}</h3>
        <p className="pn-sample__author">by {offer.author}</p>
        <p className="pn-sample__source">
          {offer.license}. {offer.provenance}.
        </p>
        <Button className="pn-sample__action" icon="bookOpen" disabled={offer.busy} aria-busy={offer.busy || undefined} onClick={offer.onOpen}>
          {offer.busy ? 'Adding…' : offer.error ? 'Try again' : 'Open a sample book'}
        </Button>
        <p role="status" aria-live="polite" className="pn-sample__status">
          {offer.busy ? 'Adding it to your library…' : (offer.error ?? '')}
        </p>
      </div>
    </section>
  );
}
