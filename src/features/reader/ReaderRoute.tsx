import { Navigate, useParams } from 'react-router-dom';
import { SnackbarProvider } from '@/ui';
import { ReaderScreen } from './ReaderScreen';

/** Route element for `/read/:id`. Keyed by book id so opening another book starts a fresh reader. */
export default function ReaderRoute() {
  const { id } = useParams();
  if (!id) return <Navigate to="/" replace />;
  return (
    <SnackbarProvider>
      <ReaderScreen key={id} bookId={id} />
    </SnackbarProvider>
  );
}
