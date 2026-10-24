import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme, type ReaderSettings } from '@/ui';
import { ReaderScreen as DesignReaderScreen } from '@/ui/screens';
import type { BookScreenProps } from '../components/BookSummary';
import { DEFAULT_READER_SETTINGS, loadReaderSettings, READER_FONTS, saveReaderSettings } from '../reader-settings';
import { useServices } from '../services-context';
import '../screen-styles';

function chapterLine(position: BookScreenProps['position']): string {
  if (!position) return 'Not started yet';
  if (position.chapterNumber === undefined) return `${Math.round(position.percent)}% through the book`;
  return position.chapterTitle ? `Chapter ${position.chapterNumber}: ${position.chapterTitle}` : `Chapter ${position.chapterNumber}`;
}

/**
 * `/read/:id` for e-books, PDFs and documents: the design system's reader chrome (back, title,
 * chapter, "Aa" settings sheet, progress footer) in its own reader theme. The reader engine
 * renders the page as this component's children; until it ships the page area says so in plain
 * words. Reading settings are saved on the device and shared with the engine through
 * `reader-settings.ts`. Keep the default export and the `BookScreenProps` (`book`, `position`);
 * see docs/READER_ROUTES.md.
 */
export default function ReaderScreen({ book, position }: BookScreenProps) {
  const { db } = useServices();
  const navigate = useNavigate();
  const appTheme = useTheme().theme;
  const [settings, setSettings] = useState<ReaderSettings>({
    ...DEFAULT_READER_SETTINGS,
    theme: appTheme,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Saved reader settings win over the defaults; the first visit starts from the app's theme.
  useEffect(() => {
    let current = true;
    void loadReaderSettings(db, {
      ...DEFAULT_READER_SETTINGS,
      theme: appTheme,
    }).then((saved) => {
      if (current && saved) setSettings(saved);
    });
    return () => {
      current = false;
    };
    // Only on opening the book: later theme changes must not overwrite the reader's own choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const onSettingsChange = useCallback(
    (next: ReaderSettings) => {
      setSettings(next);
      void saveReaderSettings(db, next);
    },
    [db],
  );
  const onSettingsOpenChange = useCallback((open: boolean) => setSettingsOpen(open), []);
  const onBack = useCallback(() => navigate('/'), [navigate]);

  return (
    <DesignReaderScreen
      title={book.title}
      chapter={chapterLine(position)}
      progress={(position?.percent ?? 0) / 100}
      settings={settings}
      fonts={READER_FONTS}
      onSettingsChange={onSettingsChange}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={onSettingsOpenChange}
      onBack={onBack}
    >
      <p role="note">The reader arrives in a later release. Your place in this book is saved on this device and will be used when it does.</p>
    </DesignReaderScreen>
  );
}
