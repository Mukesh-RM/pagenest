import { BookSummary, type BookScreenProps } from '../components/BookSummary';

/**
 * `/listen/:id` for audiobooks. This is the screen the audio player replaces: keep the default
 * export and the `BookScreenProps` (`book`, `position`), and see docs/READER_ROUTES.md.
 */
export default function PlayerScreen({ book, position }: BookScreenProps) {
  return (
    <BookSummary
      book={book}
      position={position}
      note="The player arrives in a later release. Your place in this audiobook is saved on this device and will be used when it does."
    />
  );
}
