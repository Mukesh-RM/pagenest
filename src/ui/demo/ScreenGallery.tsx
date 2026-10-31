import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import '../styles/index.css';
import '../styles/screens.css';
import '../styles/surfaces.css';
import './gallery.css';
import { AppShell } from '../components/AppShell';
import { BookCard } from '../components/BookCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ErrorNotice, PLAIN_ERRORS, type PlainErrorKind } from '../components/ErrorNotice';
import { FinishedMoment } from '../components/FinishedMoment';
import { GestureHint, memoryHintStore } from '../components/GestureHint';
import { Illustration, type IllustrationName } from '../components/Illustration';
import { MiniPlayer } from '../components/MiniPlayer';
import { DEFAULT_NAV_ITEMS } from '../components/navigation';
import { ResumeCard } from '../components/ResumeCard';
import { AudioPlayerScreen } from '../screens/AudioPlayerScreen';
import { BookDetailSheet } from '../screens/BookDetailSheet';
import { LibraryScreen } from '../screens/LibraryScreen';
import { CollectionsScreen } from '../screens/CollectionsScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { CollectionNameSheet } from '../components/CollectionNameSheet';
import { CollectionBooksEmpty } from '../components/CollectionBooksEmpty';
import { DEFAULT_LIBRARY_FILTERS } from '../screens/libraryOptions';
import { ReaderScreen } from '../screens/ReaderScreen';
import { VoiceStudioScreen } from '../screens/VoiceStudioScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { InstallHelpSheet } from '../components/InstallHelpSheet';
import { ThemePicker } from '../components/ThemePicker';
import type { StarterBookOffer } from '../components/StarterBookCard';
import type { ThemeChoice } from '../theme/themes';
import { ShortcutsProvider } from '../shortcuts';
import { ThemeProvider } from '../theme/ThemeProvider';
import type { ThemeName } from '../theme/themes';
import type { BookSummary, PlayerBookmark, ReaderSettings } from '../types';
import { timeLeftLabel } from '../utils/time';
import {
  SAMPLE_BOOKS,
  SAMPLE_CHAPTER,
  SAMPLE_DETAIL,
  SAMPLE_DETAIL_AUDIO,
  SAMPLE_DETAIL_LONG,
  SAMPLE_SHELVES,
  SAMPLE_WEEK_MINUTES,
  SAMPLE_FONTS,
  SAMPLE_PARAGRAPHS,
  SAMPLE_READER_SETTINGS,
  SAMPLE_VOICES,
} from './sample-data';

/** Every screen the gallery can show, in the order of the index page. */
export const GALLERY_SCREENS = [
  'library',
  'library-resume',
  'covers',
  'library-loading',
  'library-empty',
  'library-error',
  'detail',
  'detail-long',
  'detail-audio',
  'reader',
  'reader-aa',
  'player',
  'voice',
  'confirm',
  'finished',
  'errors',
  'empty-states',
  'shortcuts',
  'onboarding-1',
  'onboarding-2',
  'onboarding-3',
  'settings',
  'install-sheet',
  'library-starter',
  'collections',
  'collections-empty',
  'collections-loading',
  'collections-new',
  'collections-shelf-empty',
  'stats',
  'stats-empty',
  'stats-loading',
] as const;
export type GalleryScreenName = (typeof GALLERY_SCREENS)[number];

export function isGalleryScreen(value: string | null | undefined): value is GalleryScreenName {
  return !!value && (GALLERY_SCREENS as readonly string[]).includes(value);
}

const noop = () => undefined;

const NOW_PLAYING = SAMPLE_BOOKS[0]!;

function Frame({ children }: { children: ReactNode }) {
  return <div className="pn-gallery-page">{children}</div>;
}

/** A plain rectangle as a cover image, to show how `contain` letterboxes pictures that are not 2:3. */
function shapeCover(width: number, height: number, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#2a3f6f"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-size="${Math.round(Math.min(width, height) / 6)}" fill="#ffffff">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Covers: monogram tiles with every badge, and pictures of other shapes shown whole. */
function CoversDemo() {
  const plain = SAMPLE_BOOKS.filter((b) => !b.coverUrl);
  const pictures: BookSummary[] = [
    { id: 'p1', title: 'Square picture', progress: 0.5, coverUrl: shapeCover(600, 600, '1 : 1') },
    { id: 'p2', title: 'Wide picture', progress: 0.5, coverUrl: shapeCover(900, 600, '3 : 2') },
    { id: 'p3', title: 'Tall picture', progress: 0.5, coverUrl: shapeCover(400, 600, '2 : 3') },
  ];
  const badged: BookSummary[] = [
    { id: 'm1', title: 'Quiet Hours', progress: 1, favorite: true },
    { id: 'm2', title: 'Nightjar', progress: 0.4, audio: true, favorite: true },
    { id: 'm3', title: 'Orchard Keeper', progress: 1, audio: true, favorite: true },
    { id: 'm4', title: 'Zebra Crossing', progress: 0 },
  ];
  const group = (label: string, books: readonly BookSummary[]) => (
    <section aria-label={label}>
      <h2 className="pn-gallery-h">{label}</h2>
      <ul className="pn-gallery-covers">
        {books.map((book) => (
          <li key={book.id}>
            <BookCard book={book} onOpen={noop} />
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <Frame>
      <div className="pn-gallery-stack">
        {group('Monogram covers (no cover image)', plain)}
        {group('Monogram with favorite, audio and finished badges', badged)}
        {group('Pictures that are not 2:3 are shown whole', pictures)}
      </div>
    </Frame>
  );
}

function LibraryDemo({
  loading,
  empty,
  error,
  detail,
  detailBook,
  helpOpen,
  welcome,
  starter,
}: {
  starter?: StarterBookOffer;
  /** The first-run view: Welcome back card and one gesture hint, no mini-player. */
  welcome?: boolean;
  loading?: boolean;
  empty?: boolean;
  error?: boolean;
  detail?: boolean;
  detailBook?: 'short' | 'long' | 'audio';
  helpOpen?: boolean;
}) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(!!detail);
  const [tab, setTab] = useState('library');
  const searchRef = useRef<HTMLInputElement>(null);
  const hints = useMemo(() => memoryHintStore(), []);
  const books = useMemo<readonly BookSummary[]>(() => {
    if (empty) return [];
    return SAMPLE_BOOKS.filter((b) => {
      if (filter === 'reading' && (b.audio || b.progress >= 1 || b.progress === 0)) return false;
      if (filter === 'listening' && !b.audio) return false;
      if (filter === 'finished' && b.progress < 1) return false;
      return query.trim() === '' || b.title.toLowerCase().includes(query.trim().toLowerCase());
    });
  }, [empty, filter, query]);

  const handlers = useMemo(() => ({ search: () => searchRef.current?.focus() }), []);
  return (
    <ShortcutsProvider handlers={handlers}>
      <AppShell
        items={DEFAULT_NAV_ITEMS}
        value={tab}
        onSelect={setTab}
        miniPlayer={
          loading || empty || welcome ? undefined : (
            <MiniPlayer
              title={NOW_PLAYING.title}
              subtitle="Chapter 7: The orchard in March"
              coverUrl={NOW_PLAYING.coverUrl}
              playing={false}
              progress={0.42}
              onTogglePlay={noop}
              onSkipBack={noop}
              onExpand={noop}
            />
          )
        }
      >
        <LibraryScreen
          books={books}
          loading={loading}
          filters={DEFAULT_LIBRARY_FILTERS}
          filter={filter}
          onFilterChange={setFilter}
          query={query}
          onQueryChange={setQuery}
          searchRef={searchRef}
          onOpenBook={() => setOpen(true)}
          onAdd={noop}
          starter={starter}
          notice={error ? <ErrorNotice kind="offline" actionLabel="Try again" onAction={noop} /> : undefined}
          resume={
            !welcome ? undefined : (
              <ResumeCard book={NOW_PLAYING} where="chapter 7" mode="listen" onResume={noop} onDismiss={noop} />
            )
          }
          hint={
            !welcome ? undefined : (
              <GestureHint id="long-press" message="Press and hold a book to select several." store={hints} />
            )
          }
        />
      </AppShell>
      <BookDetailSheet
        open={open}
        book={detailBook === 'long' ? SAMPLE_DETAIL_LONG : detailBook === 'audio' ? SAMPLE_DETAIL_AUDIO : SAMPLE_DETAIL}
        onClose={() => setOpen(false)}
        onRead={noop}
        onListen={noop}
        onEdit={noop}
        onRemove={noop}
      />
      {helpOpen ? <HelpOpener /> : null}
    </ShortcutsProvider>
  );
}

function HelpOpener() {
  useEffect(() => {
    const id = window.setTimeout(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true })), 50);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}

function ReaderDemo({ aa, theme }: { aa?: boolean; theme: ThemeName }) {
  const [settings, setSettings] = useState<ReaderSettings>({ ...SAMPLE_READER_SETTINGS, theme });
  const [open, setOpen] = useState(!!aa);
  return (
    <ReaderScreen
      title="The Orchard at the End of Winter"
      chapter={SAMPLE_CHAPTER}
      progress={0.42}
      minutesLeftInChapter={8}
      settings={settings}
      fonts={SAMPLE_FONTS}
      onSettingsChange={setSettings}
      settingsOpen={open}
      onSettingsOpenChange={(next) => setOpen(next)}
      onBack={noop}
      onOpenContents={noop}
    >
      <h2>{SAMPLE_CHAPTER.replace('Chapter 7: ', 'Seven. ')}</h2>
      {SAMPLE_PARAGRAPHS.map((p) => (
        <p key={p.slice(0, 24)}>{p}</p>
      ))}
    </ReaderScreen>
  );
}

const SPEEDS = [1, 1.25, 1.5, 2, 0.75];

/** Demo bookmarks for the gallery (the app reads the real ones from the data layer). */
const DEMO_BOOKMARKS: readonly PlayerBookmark[] = [
  { id: 'bm1', positionSec: 12 * 60 + 40, label: 'Ines arrives at the gate', chapter: 'Chapter 1: The long road' },
  { id: 'bm2', positionSec: 2 * 3600 + 3 * 60 + 9, chapter: 'Chapter 4: What the trees remember' },
  { id: 'bm3', positionSec: 3 * 3600 + 51 * 60 + 30, label: 'Recipe for the plum cake, read again before Sunday and copy it out for Mara', chapter: 'Chapter 6: Windfall' },
];

function PlayerDemo() {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(4 * 3600 + 5 * 60 + 12);
  const [speedIndex, setSpeedIndex] = useState(1);
  const duration = SAMPLE_DETAIL.durationSeconds ?? 9 * 3600;
  const speed = SPEEDS[speedIndex]!;
  const [bookmarks, setBookmarks] = useState<readonly PlayerBookmark[]>(DEMO_BOOKMARKS);
  const [skip, setSkip] = useState({ back: 15, forward: 30 });
  return (
    <AudioPlayerScreen
      book={SAMPLE_DETAIL}
      chapter="Chapter 7: The orchard in March"
      playing={playing}
      position={position}
      duration={duration}
      speed={speed}
      sleepLabel="Off"
      onTogglePlay={() => setPlaying((p) => !p)}
      onSeek={setPosition}
      onSkip={(delta) => setPosition((p) => Math.min(duration, Math.max(0, p + delta)))}
      onSpeedClick={() => setSpeedIndex((i) => (i + 1) % SPEEDS.length)}
      onSleepClick={noop}
      onChaptersClick={noop}
      onCollapse={noop}
      skipBackSeconds={skip.back}
      skipForwardSeconds={skip.forward}
      onSkipIntervalChange={(direction, seconds) => setSkip((s) => ({ ...s, [direction]: seconds }))}
      bookmarks={bookmarks}
      onAddBookmark={(positionSec) => setBookmarks((list) => [...list, { id: `bm-${positionSec}-${list.length}`, positionSec }])}
      onDeleteBookmark={(bookmark) => setBookmarks((list) => list.filter((b) => b.id !== bookmark.id))}
    />
  );
}

function VoiceDemo() {
  const [selected, setSelected] = useState('v-amelia');
  const [previewing, setPreviewing] = useState<string | undefined>();
  return (
    <VoiceStudioScreen
      voices={SAMPLE_VOICES}
      selectedId={selected}
      onSelect={setSelected}
      onPreview={(voice) => setPreviewing((p) => (p === voice.id ? undefined : voice.id))}
      previewingId={previewing}
      onNext={noop}
      onBack={noop}
    />
  );
}

/** A real public-domain book (Project Gutenberg #1342). The app supplies the real bundled file; the gallery only shows the card. */
const STARTER: StarterBookOffer = {
  title: 'Pride and Prejudice',
  author: 'Jane Austen',
  license: 'Public domain',
  provenance: 'Project Gutenberg, ebook 1342',
  onOpen: noop,
};

function OnboardingDemo({ start, theme }: { start: number; theme: ThemeName }) {
  const [step, setStep] = useState(start);
  const [choice, setChoice] = useState<ThemeChoice>(theme);
  return (
    <OnboardingScreen
      step={step}
      onNext={() => setStep((n) => Math.min(2, n + 1))}
      onBack={() => setStep((n) => Math.max(0, n - 1))}
      onSkip={noop}
      onDone={noop}
      starter={STARTER}
      onAddBooks={noop}
      look={<ThemePicker value={choice} onChange={setChoice} onCustomChange={noop} />}
    />
  );
}

function SettingsDemo({ sheet, theme }: { sheet?: boolean; theme: ThemeName }) {
  const [choice, setChoice] = useState<ThemeChoice>(theme);
  const [size, setSize] = useState(16);
  const [open, setOpen] = useState(!!sheet);
  return (
    <AppShell items={DEFAULT_NAV_ITEMS} value="settings" onSelect={noop}>
      <SettingsScreen
        theme={choice}
        onThemeChange={setChoice}
        onCustomThemeChange={noop}
        textSize={size}
        onTextSizeChange={setSize}
        install={
          <button type="button" className="pn-btn pn-btn--secondary" onClick={() => setOpen(true)}>
            Install help
          </button>
        }
        storage={{ usageText: 'InkQuiet uses 38 MB of about 41 GB available.', persisted: false, onKeepData: noop }}
      />
      <InstallHelpSheet
        open={open}
        onClose={() => setOpen(false)}
        showIosSteps
        persistence={{ supported: true, persisted: false, usageText: '38 MB of about 41 GB', onRequest: noop }}
      />
    </AppShell>
  );
}

function CollectionsDemo({ empty, loading, naming }: { empty?: boolean; loading?: boolean; naming?: boolean }) {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(!!naming);
  return (
    <AppShell items={DEFAULT_NAV_ITEMS} value="collections" onSelect={noop}>
      <CollectionsScreen
        shelves={empty ? [] : SAMPLE_SHELVES}
        loading={loading}
        onOpenShelf={noop}
        onOpenSmart={noop}
        onCreate={() => setOpen(true)}
        onRename={noop}
        onDelete={noop}
        onMove={noop}
      />
      <CollectionNameSheet open={open} mode="create" name={name} onNameChange={setName} onSubmit={() => setOpen(false)} onClose={() => setOpen(false)} />
    </AppShell>
  );
}

const WEEK_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function StatsDemo({ empty, loading }: { empty?: boolean; loading?: boolean }) {
  return (
    <AppShell items={DEFAULT_NAV_ITEMS} value="stats" onSelect={noop}>
      <StatsScreen
        loading={loading}
        minutesPerDay={empty ? Array<number>(7).fill(0) : SAMPLE_WEEK_MINUTES}
        dayLabels={WEEK_LABELS}
        dayNames={WEEK_NAMES}
        sessionCount={empty ? 0 : 9}
        finishedBooks={empty ? 0 : 4}
        emptyAction={{ label: 'Open your library', icon: 'library', onClick: noop }}
      />
    </AppShell>
  );
}

function ConfirmDemo() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <LibraryDemo />
      <ConfirmDialog
        open={open}
        title="Remove this book?"
        description="It leaves this device. Your place and notes stay in your backup."
        confirmLabel="Remove"
        destructive
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

const ERROR_KINDS = Object.keys(PLAIN_ERRORS) as PlainErrorKind[];
const ART: readonly IllustrationName[] = ['books', 'shelf', 'chart', 'headphones', 'offline', 'search', 'page', 'done'];

/** Render one named screen. Used by the dev gallery page; never imported by the app. */
export function ScreenGallery({ screen, theme = 'light' }: { screen: GalleryScreenName; theme?: ThemeName }) {
  switch (screen) {
    case 'library':
      return <LibraryDemo />;
    case 'covers':
      return <CoversDemo />;
    case 'library-resume':
      return <LibraryDemo welcome />;
    case 'library-loading':
      return <LibraryDemo loading />;
    case 'library-empty':
      return <LibraryDemo empty />;
    case 'library-error':
      return <LibraryDemo error />;
    case 'detail':
      return <LibraryDemo detail />;
    case 'detail-long':
      return <LibraryDemo detail detailBook="long" />;
    case 'detail-audio':
      return <LibraryDemo detail detailBook="audio" />;
    case 'reader':
      return <ReaderDemo theme={theme} />;
    case 'reader-aa':
      return <ReaderDemo aa theme={theme} />;
    case 'player':
      return <PlayerDemo />;
    case 'voice':
      return <VoiceDemo />;
    case 'confirm':
      return <ConfirmDemo />;
    case 'onboarding-1':
      return <OnboardingDemo start={0} theme={theme} />;
    case 'onboarding-2':
      return <OnboardingDemo start={1} theme={theme} />;
    case 'onboarding-3':
      return <OnboardingDemo start={2} theme={theme} />;
    case 'settings':
      return <SettingsDemo theme={theme} />;
    case 'install-sheet':
      return <SettingsDemo sheet theme={theme} />;
    case 'library-starter':
      return <LibraryDemo empty starter={STARTER} />;
    case 'collections':
      return <CollectionsDemo />;
    case 'collections-empty':
      return <CollectionsDemo empty />;
    case 'collections-loading':
      return <CollectionsDemo loading />;
    case 'collections-new':
      return <CollectionsDemo naming />;
    case 'collections-shelf-empty':
      return (
        <Frame>
          <CollectionBooksEmpty name="Summer reading" action={{ label: 'Go to your library', icon: 'library', onClick: noop }} />
        </Frame>
      );
    case 'stats':
      return <StatsDemo />;
    case 'stats-empty':
      return <StatsDemo empty />;
    case 'stats-loading':
      return <StatsDemo loading />;
    case 'shortcuts':
      return <LibraryDemo helpOpen />;
    case 'finished':
      return (
        <Frame>
          <FinishedMoment
            book={SAMPLE_BOOKS[3]!}
            summary="You spent 6 h 20 min with it over two weeks."
            onNext={noop}
            nextLabel="Pick your next book"
            onSecondary={noop}
            secondaryLabel="Add to a shelf"
          />
        </Frame>
      );
    case 'errors':
      return (
        <Frame>
          <div className="pn-gallery-stack">
            {ERROR_KINDS.map((kind) => (
              <ErrorNotice key={kind} kind={kind} actionLabel="Try again" onAction={noop} onDismiss={noop} />
            ))}
          </div>
        </Frame>
      );
    case 'empty-states':
      return (
        <Frame>
          <div className="pn-gallery-stack">
            {ART.map((name) => (
              <EmptyState
                key={name}
                title={`Illustration: ${name}`}
                description="One calm sentence about what to do next."
                art={<Illustration name={name} />}
                action={{ label: 'Do the next thing', onClick: noop }}
                headingLevel={3}
              />
            ))}
          </div>
        </Frame>
      );
    default:
      return null;
  }
}

export interface GalleryOptions {
  theme: ThemeName;
  /** Text size, 1 = 100 %, 2 = 200 %. */
  scale: number;
  reduceMotion: boolean;
}

/** Applies the theme and the text scale the way the app does, then renders the screen. */
export function GalleryRoot({ screen, theme, scale, reduceMotion }: GalleryOptions & { screen: GalleryScreenName }) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--pn-font-size', `${16 * scale}px`);
    root.style.fontSize = `${16 * scale}px`;
    root.setAttribute('data-reduce-motion', reduceMotion ? 'true' : 'false');
    return () => {
      root.style.removeProperty('--pn-font-size');
      root.style.removeProperty('font-size');
      root.removeAttribute('data-reduce-motion');
    };
  }, [scale, reduceMotion]);
  return (
    <ThemeProvider mode={theme}>
      <ScreenGallery screen={screen} theme={theme} />
    </ThemeProvider>
  );
}

export { timeLeftLabel };
