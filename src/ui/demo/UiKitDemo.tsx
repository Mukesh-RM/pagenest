import { useEffect, useState, type ReactNode } from 'react';
import '../styles/index.css';
import { AppShell } from '../components/AppShell';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip, ChipGroup } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { MiniPlayer } from '../components/MiniPlayer';
import { DEFAULT_NAV_ITEMS, Rail, TabBar } from '../components/navigation';
import { ProgressBar } from '../components/ProgressBar';
import { Skeleton, SkeletonCard, SkeletonGroup } from '../components/Skeleton';
import { SnackbarProvider, SnackbarView, useSnackbar } from '../components/Snackbar';
import {
  CONTRAST_LABELS,
  CONTRAST_MODES,
  THEME_LABELS,
  THEME_MODES,
  THEME_NAMES,
  resolveContrast,
  resolveTheme,
  type ContrastLevel,
  type ContrastMode,
  type ThemeMode,
  type ThemeName,
} from '../theme/themes';
import { ThemeScope, useSystemPrefersDark, useSystemPrefersMoreContrast } from '../theme/ThemeProvider';
import { InstallBanner } from '../components/InstallBanner';
import { IosInstallSheet } from '../components/IosInstallSheet';
import { UpdateAvailableSnackbar } from '../components/UpdateAvailableSnackbar';

/* Demo-only styles live here so the design system stays free of one-off CSS. */
const DEMO_CSS = `
.pn-demo-scope { min-height: 100vh; }
.pn-demo { max-width: 960px; margin: 0 auto; padding: var(--pn-space-6) var(--pn-margin) var(--pn-space-16); }
.pn-demo h1 { font-size: var(--pn-text-xl); margin: 0 0 var(--pn-space-2); }
.pn-demo h2 { font-size: var(--pn-text-lg); margin: var(--pn-space-8) 0 var(--pn-space-3); }
.pn-demo h3 { font-size: var(--pn-text-md); margin: var(--pn-space-4) 0 var(--pn-space-2); color: rgb(var(--pn-muted)); }
.pn-demo__row { display: flex; flex-wrap: wrap; gap: var(--pn-space-3); align-items: center; }
.pn-demo__grid { display: grid; gap: var(--pn-space-4); grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
.pn-demo__themes { display: grid; gap: var(--pn-space-4); grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.pn-demo__theme-panel { padding: var(--pn-space-4); border: var(--pn-border-width) solid rgb(var(--pn-line)); border-radius: var(--pn-radius-card); display: flex; flex-direction: column; gap: var(--pn-space-3); }
.pn-demo__cover { display: block; aspect-ratio: 2 / 3; background: rgb(var(--pn-accent)); }
.pn-demo__switcher { position: sticky; top: 0; z-index: var(--pn-z-nav); padding: var(--pn-space-2) 0; background: rgb(var(--pn-page)); }
.pn-demo__frame { border: var(--pn-border-width) solid rgb(var(--pn-line)); border-radius: var(--pn-radius-card); overflow: hidden; }
.pn-demo__frame .pn-tabbar { display: block; }
.pn-demo__frame .pn-rail { display: flex; position: static; }
.pn-demo__rail-frame { display: flex; min-height: 320px; }
.pn-demo__rail-frame .pn-tabbar { display: none; }
.pn-demo__rail-frame .pn-demo__rail-content { flex: 1; padding: var(--pn-space-4); }
.pn-demo__nav-frame .pn-tabbar { display: block; }
.pn-demo__shell-preview { position: fixed; inset: 0; z-index: 50; overflow: auto; background: rgb(var(--pn-page)); }
`;

const SAMPLE_BOOKS = [
  { title: 'The Quiet Orchard', author: 'A. Reader', progress: 0.62, audio: false },
  { title: 'Night Trains', author: 'M. Narrator', progress: 0.18, audio: true },
  { title: 'Paper Lanterns', author: 'S. Author', progress: 1, audio: false },
] as const;

/** Every component in one themed panel; rendered once per theme in the side-by-side section. */
function ThemePanel({ theme }: { theme: ThemeName }) {
  const [filter, setFilter] = useState('reading');
  return (
    <ThemeScope theme={theme} className="pn-demo__theme-panel">
      <h3 style={{ margin: 0 }}>{THEME_LABELS[theme]}</h3>
      <div className="pn-demo__row">
        <Button>Read</Button>
        <Button variant="secondary">Listen</Button>
        <Button variant="ghost">Details</Button>
        <Button variant="danger">Delete</Button>
      </div>
      <ChipGroup label={`${THEME_LABELS[theme]} filters`}>
        {[
          ['reading', 'Reading now'],
          ['listening', 'Listening'],
          ['finished', 'Finished'],
        ].map(([id, label]) => (
          <Chip key={id} selected={filter === id} onClick={() => setFilter(id!)}>
            {label}
          </Chip>
        ))}
      </ChipGroup>
      <Card>
        <span className="pn-card__title">Card on {THEME_LABELS[theme]}</span>
        <span className="pn-card__meta">Secondary text stays readable.</span>
        <p style={{ margin: '8px 0 0' }}>
          Body text with a <a href="#demo" style={{ color: 'rgb(var(--pn-link))' }}>link</a>.
        </p>
        <ProgressBar value={0.4} label="Progress" />
      </Card>
      <SnackbarView message="Book deleted" onAction={() => undefined} />
      <SkeletonGroup>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="rect" height={32} />
      </SkeletonGroup>
    </ThemeScope>
  );
}

interface ThemeSwitcherProps {
  mode: ThemeMode;
  theme: ThemeName;
  onChange: (mode: ThemeMode) => void;
  contrastMode: ContrastMode;
  contrast: ContrastLevel;
  onContrastChange: (mode: ContrastMode) => void;
}

function ThemeSwitcher({ mode, theme, onChange, contrastMode, contrast, onContrastChange }: ThemeSwitcherProps) {
  return (
    <div className="pn-demo__switcher">
      <ChipGroup label="App theme" scroll>
        {THEME_MODES.map((m: ThemeMode) => (
          <Chip key={m} selected={mode === m} onClick={() => onChange(m)}>
            {THEME_LABELS[m]}
          </Chip>
        ))}
      </ChipGroup>
      <ChipGroup label="Contrast" scroll>
        {CONTRAST_MODES.map((m: ContrastMode) => (
          <Chip key={m} selected={contrastMode === m} onClick={() => onContrastChange(m)}>
            {CONTRAST_LABELS[m]}
          </Chip>
        ))}
      </ChipGroup>
      <p className="pn-card__meta" style={{ margin: '4px 0 0' }}>
        Showing: {THEME_LABELS[theme]}, {contrast === 'high' ? 'high contrast' : 'standard contrast'}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function DemoBody({ mode, theme, onChange: onModeChange, contrastMode, contrast, onContrastChange }: ThemeSwitcherProps) {
  const [sheet, setSheet] = useState(false);
  const [nested, setNested] = useState(false);
  const [tab, setTab] = useState('library');
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [reduce, setReduce] = useState(false);
  const [shell, setShell] = useState(false);
  const [iosSheet, setIosSheet] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);

  // The reduce-motion switch writes a document attribute; put it back when the demo closes.
  useEffect(() => () => document.documentElement.removeAttribute('data-reduce-motion'), []);
  const snackbar = useSnackbar();

  return (
    <div className="pn-demo">
      <style>{DEMO_CSS}</style>
      <h1>PageNest UI kit</h1>
      <p style={{ color: 'rgb(var(--pn-muted))', margin: 0 }}>
        Every component in every theme. Dev only: mount this route in development builds.
      </p>
      <ThemeSwitcher mode={mode} theme={theme} onChange={onModeChange} contrastMode={contrastMode} contrast={contrast} onContrastChange={onContrastChange} />

      <Section title="Motion">
        <Chip
          selected={reduce}
          onClick={() => {
            const next = !reduce;
            setReduce(next);
            document.documentElement.setAttribute('data-reduce-motion', next ? 'true' : 'false');
          }}
        >
          Reduce motion
        </Chip>
      </Section>

      <Section title="All themes side by side">
        <div className="pn-demo__themes">
          {THEME_NAMES.map((t) => (
            <ThemePanel key={t} theme={t} />
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="pn-demo__row">
          <Button icon="play">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon="close">
            Danger
          </Button>
          <Button size="lg">Large</Button>
          <Button iconOnly icon="plus" aria-label="Add a book" />
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Chips">
        <ChipGroup label="Quick actions">
          <Chip icon="bookmark">Bookmark</Chip>
          <Chip icon="headphones">Listen</Chip>
          <Chip selected>Selected</Chip>
          <Chip selected={false}>Not selected</Chip>
        </ChipGroup>
      </Section>

      <Section title="Cards (tap, or long-press / right-click to select)">
        <div className="pn-demo__grid">
          {SAMPLE_BOOKS.map((book) => (
            <Card
              key={book.title}
              flush
              selected={selected === book.title}
              onPress={() => setSelected(null)}
              onLongPress={() => setSelected(book.title)}
              aria-label={`${book.title} by ${book.author}`}
            >
              <span className="pn-demo__cover" />
              <ProgressBar value={book.progress} label={`${book.title} progress`} />
              <span className="pn-card__body">
                <span className="pn-card__title">{book.title}</span>
                <span className="pn-card__meta">{book.author}</span>
              </span>
            </Card>
          ))}
        </div>
        <h3>Static card</h3>
        <Card>
          <span className="pn-card__title">Reading stats</span>
          <span className="pn-card__meta">Quiet, informational surface.</span>
        </Card>
      </Section>

      <Section title="Bottom sheet">
        <div className="pn-demo__row">
          <Button onClick={() => setSheet(true)}>Open sheet</Button>
        </div>
        <BottomSheet
          open={sheet}
          onClose={() => setSheet(false)}
          title="Look and feel"
          footer={<Button block onClick={() => setNested(true)}>Open a second sheet</Button>}
        >
          <p>
            Close me with the back gesture, Esc, the scrim, the close button, or by swiping down on the handle.
          </p>
          <ChipGroup label="Theme">
            {THEME_MODES.map((m) => (
              <Chip key={m}>{THEME_LABELS[m]}</Chip>
            ))}
          </ChipGroup>
        </BottomSheet>
        <BottomSheet open={nested} onClose={() => setNested(false)} title="Second sheet">
          <p>Back closes this one first, then the sheet below it.</p>
        </BottomSheet>
      </Section>

      <Section title="Navigation (tab bar on phones, rail from 768 px)">
        <h3>TabBar</h3>
        <div className="pn-demo__frame pn-demo__nav-frame">
          <TabBar items={DEFAULT_NAV_ITEMS} value={tab} onSelect={setTab} label="Demo tab bar" />
        </div>
        <h3>Rail</h3>
        <div className="pn-demo__frame pn-demo__rail-frame">
          <Rail
            items={DEFAULT_NAV_ITEMS}
            value={tab}
            onSelect={setTab}
            label="Demo rail"
            footer={<Button iconOnly icon="plus" aria-label="Add a book" />}
          />
          <div className="pn-demo__rail-content">Current tab: {tab}</div>
        </div>
      </Section>

      <Section title="Mini-player (visual only)">
        <MiniPlayer
          title="Night Trains"
          subtitle="Chapter 7 · M. Narrator"
          playing={playing}
          progress={0.35}
          onTogglePlay={() => setPlaying((p) => !p)}
          onSkipBack={() => undefined}
          onExpand={() => undefined}
        />
      </Section>

      <Section title="Snackbar with Undo (8 s)">
        <div className="pn-demo__row">
          <Button
            variant="secondary"
            onClick={() =>
              snackbar.show({
                message: 'Moby Dick deleted',
                onAction: () => undefined,
              })
            }
          >
            Delete a book
          </Button>
        </div>
      </Section>

      <Section title="Install and update prompts (visual only)">
        <h3>Android install banner</h3>
        {bannerOpen ? (
          <InstallBanner onInstall={() => setBannerOpen(false)} onDismiss={() => setBannerOpen(false)} />
        ) : (
          <Button variant="secondary" onClick={() => setBannerOpen(true)}>
            Show the banner again
          </Button>
        )}
        <h3>iPhone install sheet</h3>
        <Button variant="secondary" onClick={() => setIosSheet(true)}>
          Open iPhone install steps
        </Button>
        <IosInstallSheet open={iosSheet} onClose={() => setIosSheet(false)} />
        <h3>Update available</h3>
        <Button variant="secondary" onClick={() => setUpdateOpen(true)}>
          Show update prompt
        </Button>
        <UpdateAvailableSnackbar open={updateOpen} onRefresh={() => setUpdateOpen(false)} onDismiss={() => setUpdateOpen(false)} />
      </Section>

      <Section title="Skeleton">
        <SkeletonGroup>
          <div className="pn-demo__grid">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </SkeletonGroup>
      </Section>

      <Section title="Empty state">
        <Card>
          <EmptyState
            title="Add your first book"
            description="Choose a file from your phone. It stays on this device."
            action={{ label: 'Choose files', icon: 'plus', onClick: () => undefined }}
          />
        </Card>
      </Section>

      <Section title="App shell">
        <p style={{ color: 'rgb(var(--pn-muted))' }}>
          Rail from 768 px, tab bar below it, mini-player above the tab bar. Resize the window to see both.
        </p>
        <Button variant="secondary" onClick={() => setShell(true)}>
          Preview app shell
        </Button>
        {shell ? (
          <div className="pn-demo__shell-preview">
            <AppShell
              items={DEFAULT_NAV_ITEMS}
              value={tab}
              onSelect={setTab}
              miniPlayer={
                <MiniPlayer
                  title="Night Trains"
                  subtitle="Chapter 7"
                  playing={playing}
                  progress={0.35}
                  onTogglePlay={() => setPlaying((p) => !p)}
                  onSkipBack={() => undefined}
                  onExpand={() => undefined}
                />
              }
            >
              <div style={{ padding: 'var(--pn-margin)' }}>
                <h2 style={{ marginTop: 0 }}>{tab}</h2>
                <Button onClick={() => setShell(false)}>Close preview</Button>
              </div>
            </AppShell>
          </div>
        ) : null}
      </Section>
    </div>
  );
}

export interface UiKitDemoProps {
  /** Initial app theme setting. Defaults to "system". */
  defaultMode?: ThemeMode;
  /** Initial contrast setting. Defaults to "system" (follows `prefers-contrast: more`). */
  defaultContrastMode?: ContrastMode;
}

/**
 * Storybook-free demo of every component in every theme. Mount in development only:
 *
 *   const UiKitDemo = lazy(() => import('../ui/demo/UiKitDemo'));
 *   {import.meta.env.DEV && <Route path="/ui-kit" element={<Suspense><UiKitDemo /></Suspense>} />}
 *
 * It brings its own scoped theme and SnackbarProvider, so it works inside or outside the app shell.
 */
export function UiKitDemo({ defaultMode = 'system', defaultContrastMode = 'system' }: UiKitDemoProps) {
  const [mode, setMode] = useState<ThemeMode>(defaultMode);
  const systemDark = useSystemPrefersDark();
  const theme = resolveTheme(mode, systemDark);
  const [contrastMode, setContrastMode] = useState<ContrastMode>(defaultContrastMode);
  const systemMoreContrast = useSystemPrefersMoreContrast();
  const contrast = resolveContrast(contrastMode, systemMoreContrast);
  // A scoped theme (not the document root), so the demo never fights the app's own theme setting.
  return (
    <ThemeScope theme={theme} contrast={contrast} className="pn-demo-scope">
      <SnackbarProvider>
        <DemoBody
          mode={mode}
          theme={theme}
          onChange={setMode}
          contrastMode={contrastMode}
          contrast={contrast}
          onContrastChange={setContrastMode}
        />
      </SnackbarProvider>
    </ThemeScope>
  );
}

export default UiKitDemo;
