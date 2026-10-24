/**
 * The importer and the sample book, without any screen. Import this from the app's start-up so that
 * registering the provider does not pull in the Library screens or their styles; load the screens
 * (`@/features/library`) with `React.lazy` where the routes are.
 */
export { createBookImporter, createLibraryProvider, ACCEPT_ANY_FILE, type LibraryProvider } from './importer';
export { createSampleBookProvider, SAMPLE_INFO } from './sample';
