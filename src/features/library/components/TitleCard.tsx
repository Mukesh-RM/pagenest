import { cardColor, initials } from '../model';

/**
 * The cover for a book with no picture: the title on a color chosen from the title (the same book
 * always gets the same color, and every color keeps white text above AA contrast). Decorative: the
 * button around it already carries the book's name.
 */
export function TitleCard({ title, author, seed }: { title: string; author?: string | undefined; seed: string }) {
  const { bg, fg } = cardColor(seed);
  return (
    <span className="pn-lib-titlecard" aria-hidden="true" style={{ backgroundColor: bg, color: fg }}>
      <span className="pn-lib-titlecard__mark">{initials(title)}</span>
      <span className="pn-lib-titlecard__title">{title}</span>
      {author ? <span className="pn-lib-titlecard__author">{author}</span> : null}
    </span>
  );
}
