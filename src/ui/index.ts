/**
 * PageNest design system. Import from "src/ui" (or your alias); importing this file also loads
 * the self-hosted Inter font, the theme tokens and the component styles.
 * The demo page is NOT exported here (keep it out of production bundles): see README.md.
 */
import './styles/index.css';

export { Button, type ButtonProps, type ButtonVariant, type IconButtonProps, type LabelButtonProps } from './components/Button';
export { Chip, ChipGroup, type ChipGroupProps, type ChipProps } from './components/Chip';
export { Card, LONG_PRESS_MS, type CardProps, type InteractiveCardProps, type StaticCardProps } from './components/Card';
export { ProgressBar, type ProgressBarProps } from './components/ProgressBar';
export { BottomSheet, type BottomSheetProps, type SheetCloseReason } from './components/BottomSheet';
export {
  DEFAULT_NAV_ITEMS,
  Rail,
  TabBar,
  type NavItem,
  type NavigationProps,
  type RailProps,
} from './components/navigation';
export { AppShell, type AppShellChrome, type AppShellProps } from './components/AppShell';
export { MiniPlayer, type MiniPlayerProps } from './components/MiniPlayer';
export {
  SNACKBAR_DURATION_MS,
  SnackbarProvider,
  SnackbarView,
  useSnackbar,
  type SnackbarApi,
  type SnackbarDismissReason,
  type SnackbarOptions,
  type SnackbarViewProps,
} from './components/Snackbar';
export { InstallBanner, type InstallBannerProps } from './components/InstallBanner';
export { IosInstallSheet, type IosInstallSheetProps } from './components/IosInstallSheet';
export { UpdateAvailableSnackbar, type UpdateAvailableSnackbarProps } from './components/UpdateAvailableSnackbar';
export { Skeleton, SkeletonCard, SkeletonGroup, type SkeletonGroupProps, type SkeletonProps } from './components/Skeleton';
export { EmptyState, type EmptyStateAction, type EmptyStateProps } from './components/EmptyState';
export { Icon, type IconName, type IconProps } from './icons';
export {
  COLOR_TOKENS,
  THEME_PALETTE,
  THEME_SCHEME,
  type ColorToken,
  THEME_LABELS,
  THEME_MODES,
  THEME_NAMES,
  THEME_PAGE_COLOR,
  ThemeProvider,
  ThemeScope,
  ThemedPortal,
  isThemeMode,
  isThemeName,
  resolveTheme,
  useSystemPrefersDark,
  useTheme,
  type ThemeContextValue,
  type ThemeMode,
  type ThemeName,
  type ThemeProviderProps,
  type ThemeScopeProps,
} from './theme';
export { prefersReducedMotion, useReducedMotion } from './utils/motion';
export { cx } from './utils/cx';

/* Redesign: building blocks */
export { BookCover, TITLE_CARD_COLORS, titleCardIndex, type BookCoverProps } from './components/BookCover';
export { BookCard, progressWords, type BookCardProps } from './components/BookCard';
export { ChoiceGroup, type ChoiceGroupProps, type ChoiceOption } from './components/ChoiceGroup';
export { Range, type RangeProps } from './components/Range';
export { ConfirmDialog, type ConfirmDialogProps } from './components/ConfirmDialog';
export { ErrorNotice, PLAIN_ERRORS, type ErrorNoticeProps, type PlainErrorKind } from './components/ErrorNotice';
export { ResumeCard, type ResumeCardProps } from './components/ResumeCard';
export { FinishedMoment, type FinishedMomentProps } from './components/FinishedMoment';
export { GestureHint, memoryHintStore, type GestureHintProps } from './components/GestureHint';
export { Illustration, type IllustrationName, type IllustrationProps } from './components/Illustration';

/* Redesign: presentational screens (props and callbacks only, no data layer) */
export { LibraryScreen, DEFAULT_LIBRARY_FILTERS, type LibraryFilterOption, type LibraryScreenProps } from './screens/LibraryScreen';
export { BookDetailSheet, type BookDetailSheetProps } from './screens/BookDetailSheet';
export { ReaderScreen, type ReaderScreenProps } from './screens/ReaderScreen';
export {
  ReaderSettingsSheet,
  LINE_HEIGHT,
  MARGIN_PX,
  READER_MAX_FONT,
  READER_MIN_FONT,
  type ReaderSettingsSheetProps,
} from './screens/ReaderSettingsSheet';
export { AudioPlayerScreen, type AudioPlayerScreenProps } from './screens/AudioPlayerScreen';
export { VoiceStudioScreen, type VoiceStudioScreenProps } from './screens/VoiceStudioScreen';
export type {
  BookDetail,
  BookSummary,
  HintStore,
  LineSpacing,
  MarginSize,
  ReaderFontOption,
  ReaderSettings,
  VoiceOption,
} from './types';

/* Redesign: laptop support, hooks and helpers */
export {
  DEFAULT_SHORTCUTS,
  SHORTCUT_DESCRIPTIONS,
  ShortcutHelpDialog,
  ShortcutsProvider,
  formatKey,
  resolveBindings,
  useShortcutBindings,
  useShortcutHelp,
  useShortcuts,
  type ShortcutAction,
  type ShortcutBindings,
  type ShortcutHandlers,
  type ShortcutsProviderProps,
  type UseShortcutsOptions,
} from './shortcuts';
export { BREAKPOINTS, minWidthQuery, useMediaQuery, useMinWidth, type Breakpoint } from './utils/media';
export { tintForTheme, useCoverTint, type CoverTint } from './hooks';
export { extractCoverColor } from './utils/coverColor';
export { formatClock, formatDuration, formatSpeed, timeLeftLabel } from './utils/time';
export { flipTransform, measure, playFlip, type RectLike } from './utils/flip';
export { preloadCriticalFonts, CRITICAL_FONT_URLS } from './fonts/preload';
