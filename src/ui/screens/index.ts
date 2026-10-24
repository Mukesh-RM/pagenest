/**
 * PageNest screens entry: `import { LibraryScreen, OnboardingScreen, ... } from '@/ui/screens'`.
 *
 * The screens and their stylesheets (screens.css, surfaces.css, about 40 percent of the design system's CSS) are a
 * separate entry on purpose. The app's first load only needs the primitives from `@/ui`; each screen's CSS then
 * travels in the lazy chunk of the route that imports it, which keeps the initial CSS under its 12 kB budget.
 * Import screens ONLY from lazy routes (React.lazy), never from the app shell.
 */
import '../styles/screens.css';
import '../styles/surfaces.css';

/* Redesign: presentational screens (props and callbacks only, no data layer) */
export { LibraryScreen, DEFAULT_LIBRARY_FILTERS, DEFAULT_LIBRARY_SORTS, type LibraryFilterOption, type LibraryScreenProps, type LibrarySortOption, type LibraryView } from './LibraryScreen';
export { BookDetailSheet, type BookDetailSheetProps } from './BookDetailSheet';
export { ReaderScreen, type ReaderScreenProps } from './ReaderScreen';
export {
  ReaderSettingsSheet,
  LINE_HEIGHT,
  MARGIN_PX,
  READER_MAX_FONT,
  READER_MIN_FONT,
  type ReaderSettingsSheetProps,
} from './ReaderSettingsSheet';
export { AudioPlayerScreen, type AudioPlayerController, type AudioPlayerScreenProps } from './AudioPlayerScreen';
export { VoiceStudioScreen, type VoiceStudioScreenProps } from './VoiceStudioScreen';

export { AppMark, type AppMarkProps } from '../components/AppMark';
export { StarterBookCard, type StarterBookOffer, type StarterBookCardProps } from '../components/StarterBookCard';
export { FirstRunBooks, type FirstRunBooksProps } from '../components/FirstRunBooks';
export { OnboardingScreen, ONBOARDING_STEP_COUNT, type OnboardingScreenProps } from './OnboardingScreen';
export { SettingsScreen, type SettingsScreenProps, type SettingsStorage } from './SettingsScreen';
export { ThemePicker, type ThemePickerProps } from '../components/ThemePicker';
export { TextSizeControl, type TextSizeControlProps } from '../components/TextSizeControl';
