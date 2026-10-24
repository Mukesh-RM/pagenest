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
export { AppShell, type AppShellProps } from './components/AppShell';
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
