import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ProgressBar } from '../components/ProgressBar';
import { ReaderScrubber } from '../components/ReaderScrubber';
import { Skeleton } from '../components/Skeleton';
import { chapterLeftLabel } from '../utils/time';
import { ThemeScope } from '../theme/ThemeProvider';
import type { ReaderErrorState, ReaderLoadingState, ReaderSettings, ReaderTocItem } from '../types';
import type { ReaderFontOption } from '../types';
import { ReaderSettingsSheet } from './ReaderSettingsSheet';
import { ReaderTocSheet } from './ReaderTocSheet';
import { LINE_HEIGHT, MARGIN_PX } from './readerOptions';
import type { SheetCloseReason } from '../components/BottomSheet';
import '../styles/screens.css';
import '../styles/surfaces.css';

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
  /** Opens the contents sheet when no `toc` list is passed. */
  onOpenContents?: () => void;
  /** Estimated minutes left in this chapter. Shown as a quiet line under the progress bar (`chapterLeftLabel`). */
  minutesLeftInChapter?: number;
  /** Tap the center of the page to show or hide the top bar and footer. Default true. */
  immersiveChrome?: boolean;
  /** Controlled overlay visibility. */
  chromeVisible?: boolean;
  onChromeVisibleChange?: (visible: boolean) => void;
  /** Chapter tick marks on the scrubber (each 0–1 through the book). With `onScrubCommit`, replaces the thin progress bar. */
  chapterTicks?: readonly number[];
  /** Spoken scrubber value and the quiet footer line, e.g. "Page 5 of 39" or "42 percent". */
  progressLabel?: string;
  scrubDisabled?: boolean;
  onScrubPreview?: (fraction: number) => void;
  onScrubCommit?: (fraction: number) => void;
  /** Built-in contents sheet. The Contents button opens it when `onTocOpenChange` is given. */
  toc?: readonly ReaderTocItem[];
  tocOpen?: boolean;
  onTocOpenChange?: (open: boolean, reason?: SheetCloseReason) => void;
  tocCurrentId?: string;
  onTocSelect?: (item: ReaderTocItem) => void;
  loading?: ReaderLoadingState;
  error?: ReaderErrorState;
  /** One viewport tall: the engine host fills the page area (PDF and paginated reflow). */
  paginated?: boolean;
  /** Two newspaper columns from 1024 px for long reflow chapters. */
  twoColumn?: boolean;
  /** Left/right page-turn hints on the page. Default true when immersive chrome is on. */
  pageAffordance?: boolean;
  onPagePrev?: () => void;
  onPageNext?: () => void;
  /** Polite announcement (for example when a page turn is blocked). */
  statusMessage?: string;
  /** Extra icon buttons in the top bar (search, bookmarks, …). Wraps on narrow viewports. */
  barTools?: ReactNode;
  /** The page content (the reader engine renders here). */
  children: ReactNode;
}

function zoneFromClientX(pageLeft: number, pageWidth: number, clientX: number): 'left' | 'center' | 'right' {
  const x = clientX - pageLeft;
  if (x < pageWidth / 3) return 'left';
  if (x > (pageWidth * 2) / 3) return 'right';
  return 'center';
}

/**
 * Reader chrome (blueprint 5.7): immersive overlays, a scrubber with chapter ticks, contents, loading and error states,
 * and a comfortable reading column (two columns from 1024 px when asked). Presentational: the reader engine supplies the page as children.
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
  minutesLeftInChapter,
  immersiveChrome = true,
  chromeVisible: chromeVisibleProp,
  onChromeVisibleChange,
  chapterTicks,
  progressLabel,
  scrubDisabled,
  onScrubPreview,
  onScrubCommit,
  toc,
  tocOpen = false,
  onTocOpenChange,
  tocCurrentId,
  onTocSelect,
  loading,
  error,
  paginated,
  twoColumn,
  pageAffordance,
  onPagePrev,
  onPageNext,
  statusMessage,
  barTools,
  children,
}: ReaderScreenProps) {
  const [chromeVisibleInternal, setChromeVisibleInternal] = useState(true);
  const chromeVisible = chromeVisibleProp ?? chromeVisibleInternal;
  const setChromeVisible = useCallback(
    (next: boolean) => {
      onChromeVisibleChange?.(next);
      if (chromeVisibleProp === undefined) setChromeVisibleInternal(next);
    },
    [chromeVisibleProp, onChromeVisibleChange],
  );
  const pageRef = useRef<HTMLElement>(null);
  const showAffordance = pageAffordance ?? immersiveChrome;
  const hasScrubber = !!onScrubCommit;
  const scrubLabel =
    progressLabel ?? (hasScrubber ? `${Math.round(progress * 100)} percent` : undefined);
  const showContents = !!(toc?.length || onTocOpenChange || onOpenContents);
  const openContents = (): void => {
    if (onTocOpenChange) onTocOpenChange(true);
    else onOpenContents?.();
  };
  const chromeHidden = immersiveChrome && !chromeVisible;
  const sheetsOpen = settingsOpen || tocOpen;

  const onPagePointerUp = (event: ReactPointerEvent): void => {
    if (!immersiveChrome || sheetsOpen) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const page = pageRef.current;
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const zone = zoneFromClientX(rect.left, rect.width, event.clientX);
    if (zone === 'center') {
      setChromeVisible(!chromeVisible);
      return;
    }
    if (zone === 'left') onPagePrev?.();
    else onPageNext?.();
  };

  useEffect(() => {
    if (sheetsOpen && immersiveChrome) setChromeVisible(true);
  }, [immersiveChrome, setChromeVisible, sheetsOpen]);

  const font = fonts.find((f) => f.id === settings.fontId) ?? fonts[0];
  const style = {
    '--pn-reader-size': `${settings.fontSize}px`,
    '--pn-reader-leading': String(LINE_HEIGHT[settings.lineSpacing]),
    '--pn-reader-margin': `${MARGIN_PX[settings.margins]}px`,
    '--pn-reader-font': font?.family,
  } as CSSProperties;

  const footerMeta = (
    <p className="pn-reader__percent">
      {minutesLeftInChapter !== undefined ? (
        <span className="pn-reader__left">{chapterLeftLabel(minutesLeftInChapter)}</span>
      ) : null}
      {scrubLabel ? <span className="pn-reader__position">{scrubLabel}</span> : null}
      <span>{Math.round(progress * 100)}% through the book</span>
    </p>
  );

  const loadingOverlay = loading ? (
    <div className="pn-reader__state" role="status" aria-live="polite">
      <div className="pn-reader__lines" aria-hidden="true">
        <Skeleton className="pn-reader__skel" width="60%" />
        <Skeleton className="pn-reader__skel" />
        <Skeleton className="pn-reader__skel" />
        <Skeleton className="pn-reader__skel" width="85%" />
        <Skeleton className="pn-reader__skel" />
      </div>
      <p className="pn-reader__message">{loading.message}</p>
    </div>
  ) : null;

  const errorOverlay = error ? (
    <div className="pn-reader__state" role="alert">
      <EmptyState
        art="alert"
        title={error.title}
        description={error.message}
        action={{ label: 'Back to library', onClick: onBack }}
        headingLevel={2}
      />
      {error.onRetry ? (
        <Button variant="secondary" onClick={error.onRetry}>
          {error.retryLabel ?? 'Try again'}
        </Button>
      ) : null}
    </div>
  ) : null;

  return (
    <ThemeScope theme={settings.theme} className="pn-reader" as="div">
      <div
        className="pn-reader__frame"
        style={style}
        data-chrome-hidden={chromeHidden ? 'true' : undefined}
        data-paginated={paginated ? 'true' : undefined}
      >
        <header className="pn-reader__bar">
          <Button iconOnly variant="ghost" icon="arrowLeft" aria-label="Back to library" onClick={onBack} />
          <div className="pn-reader__heading">
            <h1 className="pn-reader__title">{title}</h1>
            <p className="pn-reader__chapter">{chapter}</p>
          </div>
          {showContents ? (
            <Button iconOnly variant="ghost" icon="list" aria-label="Contents" onClick={openContents} />
          ) : null}
          {barTools ? <div className="pn-reader__tools">{barTools}</div> : null}
          <Button
            variant="ghost"
            aria-label="Reading settings"
            aria-haspopup="dialog"
            className="pn-reader__aa"
            onClick={() => onSettingsOpenChange(true)}
          >
            Aa
          </Button>
        </header>

        <article
          ref={pageRef}
          className="pn-reader__page"
          aria-label={`${title}, ${chapter}`}
          onPointerUp={immersiveChrome ? onPagePointerUp : undefined}
        >
          {paginated ? (
            <div className="pn-reader__stage">
              {showAffordance && !chromeHidden ? (
                <>
                  <span className="pn-reader__affordance pn-reader__affordance--prev" aria-hidden="true" />
                  <span className="pn-reader__affordance pn-reader__affordance--next" aria-hidden="true" />
                </>
              ) : null}
              <div className={`pn-reader__host${twoColumn ? ' pn-reader__host--two-column' : ''}`}>{children}</div>
              {loadingOverlay}
              {errorOverlay}
            </div>
          ) : (
            <div className={`pn-reader__text${twoColumn ? ' pn-reader__text--two-column' : ''}`}>
              {children}
              {loadingOverlay}
              {errorOverlay}
            </div>
          )}
        </article>

        <footer className="pn-reader__footer">
          {hasScrubber ? (
            <ReaderScrubber
              value={progress}
              ticks={chapterTicks}
              valueText={scrubLabel ?? `${Math.round(progress * 100)} percent`}
              disabled={scrubDisabled}
              onPreview={onScrubPreview}
              onCommit={onScrubCommit}
            />
          ) : (
            <ProgressBar value={progress} label="Progress through the book" />
          )}
          {footerMeta}
        </footer>

        <div className="pn-visually-hidden" role="status" aria-live="polite">
          {statusMessage}
        </div>
      </div>

      <ReaderSettingsSheet
        open={settingsOpen}
        onClose={(reason) => onSettingsOpenChange(false, reason)}
        settings={settings}
        fonts={fonts}
        onChange={onSettingsChange}
      />

      {onTocOpenChange && toc ? (
        <ReaderTocSheet
          open={tocOpen}
          onClose={(reason) => onTocOpenChange(false, reason)}
          items={toc}
          currentId={tocCurrentId}
          onSelect={(item) => {
            onTocSelect?.(item);
            onTocOpenChange(false);
          }}
        />
      ) : null}
    </ThemeScope>
  );
}

export default ReaderScreen;
