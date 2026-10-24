import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from './services-context';

/**
 * Stands in for the Reader bot's `ReaderScreen` in route tests (jsdom has no layout, so the real engines cannot run). It does what the
 * route contract needs from a reader: gets only a book id, shows the book's title as the page heading and has a Back button.
 * Use it with: vi.mock('@/features/reader/ReaderScreen', async () => ({ ReaderScreen: (await import('./fake-reader')).FakeReader }))
 */
export function FakeReader({ bookId }: { bookId: string }) {
  const { db } = useServices();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  useEffect(() => {
    void db.books.get(bookId).then((b) => setTitle(b?.title ?? ''));
  }, [db, bookId]);
  return (
    <main data-testid="reader-screen" data-book={bookId}>
      <button type="button" aria-label="Back to library" onClick={() => navigate('/')} />
      <h1>{title}</h1>
    </main>
  );
}
