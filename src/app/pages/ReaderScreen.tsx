import { BookSummary, type BookScreenProps } from '../components/BookSummary';

/**
 * `/read/:id` for e-books, PDFs and documents. This is the screen the reader engine replaces:
 * keep the default export and the `BookScreenProps` (`book`, `position`), and see docs/READER_ROUTES.md.
 */
export default function ReaderScreen({ book, position }: BookScreenProps) {
  return (
    <BookSummary
      book={book}
      position={position}
      note="The reader arrives in a later release. Your place in this book is saved on this device and will be used when it does."
    />
  );
}
