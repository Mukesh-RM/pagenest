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
export { IosInstallSteps } from './components/IosInstallSteps';
export { InstallHelpSheet, type InstallHelpPersistence, type InstallHelpSheetProps } from './components/InstallHelpSheet';
export { InstallHelp, type InstallHelpProps } from './pwa/InstallHelp';
export { PwaPrompts, INSTALL_BANNER_ID, IOS_INSTALL_ID, type PwaPromptsProps } from './pwa/PwaPrompts';
export { UpdateAvailableSnackbar, type UpdateAvailableSnackbarProps } from './components/UpdateAvailableSnackbar';
export { Skeleton, SkeletonCard, SkeletonGroup, type SkeletonGroupProps, type SkeletonProps } from './components/Skeleton';
export { EmptyState, type EmptyStateAction, type EmptyStateProps } from './components/EmptyState';
export { Icon, type IconName, type IconProps } from './icons';
export * from './theme';
export { prefersReducedMotion, useReducedMotion } from './utils/motion';
export { cx } from './utils/cx';

/* Redesign: building blocks */
export { BookCover, TITLE_CARD_COLORS, titleCardIndex, type BookCoverProps } from './components/BookCover';
export { BookCard, progressWords, type BookCardProps } from './components/BookCard';
export { ChoiceGroup, type ChoiceGroupProps, type ChoiceOption } from './components/ChoiceGroup';
export { Range, type RangeProps } from './components/Range';
export { ConfirmDialog, type ConfirmDialogProps } from './components/ConfirmDialog';
export { ErrorNotice, PLAIN_ERRORS, canRetry, type ErrorNoticeProps, type PlainErrorKind } from './components/ErrorNotice';
export { ResumeCard, type ResumeCardProps } from './components/ResumeCard';
export { FinishedMoment, type FinishedMomentProps } from './components/FinishedMoment';
export { GestureHint, memoryHintStore, type GestureHintProps } from './components/GestureHint';
export { Illustration, type IllustrationName, type IllustrationProps } from './components/Illustration';

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

/* Second design pass: pure helpers. The screens and their CSS live in './screens' (see README, "Entries"). */
export {
  TEXT_SIZE_DEFAULT,
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
  TEXT_SIZE_STEP,
  applyTextSize,
  clampTextSize,
  textSizePercent,
} from './utils/textSize';

/*
 * Screens are NOT exported at runtime from this barrel: they and their CSS load from '@/ui/screens' (or one module
 * each, for React.lazy: '@/ui/screens/OnboardingScreen', with a default export). Only their prop TYPES are here,
 * and types are erased, so importing this barrel in the app shell never pulls a screen into the first load.
 */
export type {
  AudioPlayerController,
  AudioPlayerScreenProps,
  BookDetailSheetProps,
  LibraryScreenProps,
  OnboardingScreenProps,
  ReaderScreenProps,
  ReaderSettingsSheetProps,
  SettingsScreenProps,
  SettingsStorage,
  VoiceStudioScreenProps,
  StarterBookOffer,
  ThemePickerProps,
  TextSizeControlProps,
} from './screens';
export { OverflowMenu, type OverflowMenuItem, type OverflowMenuProps } from './components/OverflowMenu';
