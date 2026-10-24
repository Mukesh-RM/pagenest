import type { CSSProperties, ReactNode } from 'react';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { ThemeScope } from '../theme/ThemeProvider';
import type { ReaderFontOption, ReaderSettings } from '../types';
import { LINE_HEIGHT, MARGIN_PX, ReaderSettingsSheet } from './ReaderSettingsSheet';
import type { SheetCloseReason } from '../components/BottomSheet';

export interface ReaderScreenProps {
  title: string;
  /** "Chapter 7: The orchard". */
  chapter: string;
  /** 0 to 1 through the book. */
  progress: number;
  settings: ReaderSettings;
  fonts: readonly ReaderFontOption[];
  onSettingsChange: (next: ReaderSettings) => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean, reason?: SheetCloseReason) => void;
  onBack: () => void;
  onOpenContents?: () => void;
  /** The page content (the reader engine renders here). */
  children: ReactNode;
}

/**
 * Reader chrome (blueprint 5.7): a calm top bar with Back, the title and the Aa button, the page in its own theme,
 * and a thin progress footer. The text sits in a centered column of 60 to 75 characters from tablet width up.
 * Presentational: the reader engine supplies the page as children.
 */
export function ReaderScreen({
  title,
  chapter,
  progress,
  settings,
  fonts,
  onSettingsChange,
  settingsOpen,
  onSettingsOpenChange,
  onBack,
  onOpenContents,
  children,
}: ReaderScreenProps) {
  const font = fonts.find((f) => f.id === settings.fontId) ?? fonts[0];
  const style = {
    '--pn-reader-size': `${settings.fontSize}px`,
    '--pn-reader-leading': String(LINE_HEIGHT[settings.lineSpacing]),
    '--pn-reader-margin': `${MARGIN_PX[settings.margins]}px`,
    '--pn-reader-font': font?.family,
  } as CSSProperties;
  return (
    <ThemeScope theme={settings.theme} className="pn-reader" as="div">
      <div className="pn-reader__frame" style={style}>
        <header className="pn-reader__bar">
          <Button iconOnly variant="ghost" icon="arrowLeft" aria-label="Back to library" onClick={onBack} />
          <div className="pn-reader__heading">
            <h1 className="pn-reader__title">{title}</h1>
            <p className="pn-reader__chapter">{chapter}</p>
          </div>
          {onOpenContents ? <Button iconOnly variant="ghost" icon="list" aria-label="Contents" onClick={onOpenContents} /> : null}
          <Button variant="ghost" aria-label="Reading settings" aria-haspopup="dialog" className="pn-reader__aa" onClick={() => onSettingsOpenChange(true)}>
            Aa
          </Button>
        </header>
        <article className="pn-reader__page" aria-label={`${title}, ${chapter}`}>
          <div className="pn-reader__text">{children}</div>
        </article>
        <footer className="pn-reader__footer">
          <ProgressBar value={progress} label="Progress through the book" />
          <p className="pn-reader__percent">{Math.round(progress * 100)}% through the book</p>
        </footer>
      </div>
      <ReaderSettingsSheet
        open={settingsOpen}
        onClose={(reason) => onSettingsOpenChange(false, reason)}
        settings={settings}
        fonts={fonts}
        onChange={onSettingsChange}
      />
    </ThemeScope>
  );
}
