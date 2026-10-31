# InkQuiet design system (`src/ui`)

Owned by the UI/UX designer. Implements blueprint section 5 and the "warm paper" redesign. Everything here is
TypeScript + React, plain CSS variables, no CDN: Inter and Literata (SIL OFL 1.1) and Lucide icons (ISC) are
vendored in this folder with their license files.

```ts
import { Button, Chip, Card, BottomSheet, TabBar, Rail, MiniPlayer, SnackbarProvider, useSnackbar,
         Skeleton, EmptyState, InstallBanner, IosInstallSheet, UpdateAvailableSnackbar } from '@/ui';
```

Importing `@/ui` also loads `styles/index.css` (font, tokens, component styles). It does not touch
`html`, `body` or the reset, so it is safe next to Tailwind.

## Tokens (`styles/tokens.css`, the single source of truth)

| Group | Tokens |
|---|---|
| Color (per theme) | `--pn-page`, `--pn-surface`, `--pn-surface-raised`, `--pn-text`, `--pn-muted`, `--pn-accent`, `--pn-accent-soft` (tinted fill), `--pn-accent-ink` (text on that fill), `--pn-on-accent`, `--pn-on-danger`, `--pn-link`, `--pn-border-strong`, `--pn-line`, `--pn-focus-ring`, `--pn-danger`, `--pn-inverse-*` (snackbar), `--pn-skeleton*`, `--pn-scrim` + `--pn-scrim-opacity` |
| Space (4 px grid) | `--pn-space-1` (4) to `--pn-space-16` (64), `--pn-margin` (16, 24 from 768 px) |
| Shape | `--pn-radius-card` 12, `--pn-radius-sheet` 20, `--pn-radius-pill`, `--pn-radius-button` (= pill) |
| Type | `--pn-font-sans` (Inter), `--pn-font-serif` (Literata); `--pn-text-xs/sm/md/lg/xl` = 0.75/0.875/1/1.25/1.75 rem (12/14/16/20/28 px at 100%, they scale with the text-size setting); three weights only: `--pn-weight-regular` 400, `--pn-weight-semibold` 600, `--pn-weight-bold`/`--pn-weight-heading` 700 |
| Motion | `--pn-duration-fast/base/slow` = 150/200/250 ms, `--pn-ease-out`, `--pn-ease-spring` (sheet spring-back) |
| Touch | `--pn-touch` = 44 px |

Colors are space separated RGB triplets (`250 250 247`), the same format as the app shell and
Tailwind (`rgb(var(--pn-page) / <alpha-value>)`). In plain CSS write `rgb(var(--pn-page))`.
The shared names with `src/app` are `page, surface, text, muted, accent, on-accent, line`.

**Themes**: Light (default), Sepia, Dark, Black, selected with `data-theme="light|sepia|dark|black"` on any
element (document root for the app theme, a wrapper for the separate reader theme: `<ThemeScope theme="sepia">`).
"Follow the system" is a mode resolved in script: `resolveTheme('system', prefersDark)`.
Page and text colors are the blueprint 5.2 values. The accent is one deep teal per theme: `#2F6F6B` in Light and
Sepia, a lighter teal (`#6FC2BA`) in Dark and Black. Every text pair is AA (4.5:1) in all four themes; a test computes
them from `tokens.css`.

**Text size**: the `--pn-text-*` tokens are rem, so the app's text-size setting (`html { font-size: var(--pn-font-size) }`
in `src/index.css`, or the `--pn-text-*` overrides in `src/app/apply-theme.ts`) scales everything. Layouts are checked at 200 %.

**Type**: Literata (600 to 700) for headings, book titles and the default reading font; Inter for controls and small
text. Two families and three weights are enforced by `styles/design-rules.test.ts`. Fonts are variable woff2 subset to
Latin, 97 kB in total (recipe in `fonts/README.md`). `preloadCriticalFonts()` (from `fonts/preload.ts`, exported from `@/ui`) adds
`<link rel="preload">` for Inter and Literata regular only.

**High contrast** (blueprint 5.8): `data-contrast="high"` layers over any theme, on the same element as
`data-theme` (`<ThemeProvider>`, `<ThemeScope>` and `<ThemedPortal>` write both, so scopes and sheets match).
`data-contrast="standard"` switches it off for a subtree. With no attribute, `prefers-contrast: more` turns it on
in CSS, and `<ThemeProvider>` resolves it in script. It replaces text, muted, accent, on-accent, link, danger,
border-strong, line, focus-ring and the snackbar (`--pn-inverse-*`) colors and strengthens the scrim; page and
surface colors stay the theme's own. Strokes get thicker through `--pn-focus-width` (2 to 4 px),
`--pn-focus-offset` and `--pn-border-width` (1 to 2 px). Text pairs are at least 7:1, focus ring and accent
fill at least 7:1, control borders at least 4.5:1, hairlines at least 3:1, on all 8 theme x contrast combinations.

```tsx
<ThemeProvider mode="sepia" contrastMode="high">...</ThemeProvider>   // contrastMode: 'system' | 'standard' | 'high'
const { contrast, contrastMode, setContrastMode } = useTheme();
<ThemeScope theme="light" contrast="standard">...</ThemeScope>       // omit contrast to inherit
```

Code that needs hex values: `getPalette(theme, 'high')`, `HIGH_CONTRAST_PALETTE`; helpers `resolveContrast`,
`CONTRAST_MODES`, `CONTRAST_LABELS`, `useSystemPrefersMoreContrast`. Persisting the setting is the app's job.

**Reduced motion**: durations become 0 under `prefers-reduced-motion: reduce`, and the document root
attribute `data-reduce-motion="true" | "false"` forces it on or off (in-app setting).

**Hex values for code** (`theme/palette.ts`): `THEME_PALETTE[theme][token]`, `THEME_SCHEME`, `THEME_PAGE_COLOR`.
A test fails if they differ from `tokens.css`.

## Components

| Component | Notes |
|---|---|
| `Button` | one height (44 px), one radius, one type size. `primary` filled teal; `secondary` soft tinted fill, no outline; `ghost`; `danger` quiet red text; `danger-solid` filled red, **only inside `ConfirmDialog`**. `iconOnly` requires `aria-label`. `size` is ignored (kept for old call sites) |
| `Chip`, `ChipGroup` | soft fill when selected (with a check), hairline border when not; `selected` makes it a toggle (`aria-pressed`); `scroll` makes a one-line row that scrolls instead of squeezing |
| `Card`, `ProgressBar` | `onPress` makes it a button card; `onLongPress` (500 ms, right-click, context-menu key) for multi-select |
| `BottomSheet` | slides up 250 ms; **closes on system back** (popstate) first, then Esc, scrim, swipe down, close button; focus trap, `aria-modal`, scroll lock, focus restore. Centered dialog from 768 px. See "BottomSheet history contract" |
| `TabBar` / `Rail` / `AppShell` | phone bottom bar below 768 px, left rail from 768 px; **only one of the two is in the DOM** (`useMinWidth`, no flash); `href` items render real links. See "AppShell" |
| `BookCover`, `BookCard` | cover image (**shown whole**: `object-fit: contain` on a neutral tile, the 2:3 box never changes; `fit="cover"` opts into filling and cropping), else a **monogram** on cards (one letter, see below) or the generated title card (8 AA color pairs, stable per title) in the detail sheet, title (2 lines), author (2 lines), progress bar, headphone badge for audio, check badge at 100 % |
| `ConfirmDialog` | question, consequence in plain words, Cancel (focused first) and Confirm; `destructive` makes Confirm the one filled red button |
| `ErrorNotice` | `role="alert"`, plain-word messages (`PLAIN_ERRORS`: drm, damaged, unsupported, storage, offline, voice, generic), one next step |
| `ResumeCard` | the quiet "Welcome back" card: where you were, one button, "Not now" |
| `FinishedMoment` | cover with a check, one warm sentence, one next step; no confetti |
| `GestureHint` | one-time inline hint; persistence through a passed-in `HintStore` (`hasSeen`, `markSeen`) |
| `Illustration` | themed inline SVG for empty states: books, shelf, chart, headphones, offline, search, page, done |
| `ChoiceGroup`, `Range` | radio group with arrow keys (segmented or tiles); native range with a filled track |
| `ShortcutsProvider`, `useShortcuts`, `ShortcutHelpDialog` | laptop keys, see "Laptop" |
| `MiniPlayer` | visual only, no audio; swipe up or tap to expand |
| `SnackbarProvider` + `useSnackbar().show({ message, onAction, onDismiss })` | Undo for 8 s, pauses on hover/focus, one at a time |
| `UpdateAvailableSnackbar` | props-only "New version ready" with Refresh and Dismiss |
| `InstallBanner` | props-only Android banner with Install and Not now |
| `IosInstallSheet` | props-only three-step sheet (Share, Add to Home Screen, Add) on `BottomSheet` |
| `Skeleton`, `SkeletonCard`, `SkeletonGroup` | group announces "Loading" once |
| `EmptyState` | title, description, one action |
| `Icon` | vendored Lucide, 24 px outline, decorative unless `label` is given |

## Entries, lazy loading and bundle size

| Import | What it loads | Use it for |
|---|---|---|
| `@/ui` | Primitives, theme, hooks, shell, PWA prompts and `styles/index.css` (fonts, tokens, base, components, shell). **No screen at runtime.** It also re-exports every screen's prop *types* (`export type`, erased at build time). | The app shell, first paint. Initial CSS: about 9.4 kB gzip (budget 12). |
| `@/ui/screens` | Every screen, `FirstRunBooks`, `ThemePicker`, `TextSizeControl`, `StarterBookCard` and `screens.css` + `surfaces.css`. | Lazy routes only. |
| `@/ui/screens/OnboardingScreen` (one module per screen: `LibraryScreen`, `BookDetailSheet`, `ReaderScreen`, `AudioPlayerScreen`, `VoiceStudioScreen`, `SettingsScreen`) | That screen and the two screen stylesheets, which Vite emits once as a shared lazy CSS chunk. Each has a **default export**. | `const Settings = lazy(() => import('@/ui/screens/SettingsScreen'))`. |

The barrel is side-effect free apart from the CSS import, and the screens never reach the initial chunk as long as the
app imports them through `lazy()` (bundle check: initial JS 108.3 kB gzip of 120, CSS 9.4 of 12 on this branch).
If the bundler is ever told `sideEffects: false` in `package.json`, keep `*.css` out of that rule.

### Typed props of the new screens

* `OnboardingScreen`: `step` (0 to 2), `onNext`, `onBack`, `onSkip`, `onDone`, `starter?: StarterBookOffer`,
  `onAddBooks?`, `look: ReactNode` (card 3, usually `ThemePicker` + `TextSizeControl`). Export: `OnboardingScreenProps`,
  `ONBOARDING_STEP_COUNT`. The contract the QA suite relies on is unchanged: h1 "Your books, your voice, no account.",
  "Pick a look", "Step n of 3", buttons Skip / Next / Back / Done.
* `SettingsScreen`: `theme: ThemeChoice`, `onThemeChange`, `customTheme?`, `onCustomThemeChange`, `textSize` (px, 14 to 32),
  `onTextSizeChange`, `install?: ReactNode` (pass `<InstallHelp />`), `storage?: SettingsStorage | null`
  (`{ usageText, persisted?, onKeepData? }`; `undefined` shows "Checking…", `null` hides it), `children` for more groups.
  Export: `SettingsScreenProps`, `SettingsStorage`.
* `LibraryScreen`: `onAdd` is optional (no "Add books" button without it), `emptyActions?: ReactNode` adds an action to
  the empty library, `starter?: StarterBookOffer` shows the first-run starter card, `sort` and `view` props as before.
* `AudioPlayerScreen`: optional `controller?: AudioPlayerController` (`playing, position, duration, speed, sleepLabel,
  toggle(), seek(s), skip(d), cycleSpeed(), openSleep(), openChapters()`). It wins over the individual props, which still work.
* `ReaderScreen`: optional `minutesLeftInChapter` ("8 min left in chapter" above the book progress, always visible).
* `BookDetailSheet`: `onRemove` now appears as "Remove from library" inside a "More options" (⋯) menu, never as a loose red button.
* `ErrorNotice`: DRM, damaged and unsupported files never show "Try again" (`canRetry(kind)`); they add one plain help line.

### Library needs (`feature/ui-library-needs`)

* **`useLibraryGrid(view)`** is exported from `@/ui` (with `libraryGridSpec`, `libraryColumns`, `LibraryGridSpec`). It returns
  `{ spec, columns }` for `VirtualList`: `gap={grid.spec.gap}`, `rowGap={grid.spec.rowGap}`, `columns={grid.columns}`.
  It follows the same breakpoints and minimum card widths as the CSS grid (9/10/11/12 rem; list view one column, two from
  1024 px), re-renders on a breakpoint change, and reads the root font size on every call, so 200% text gives fewer, wider columns.
* **Monogram covers**: `BookCover monogram` (and every `BookCard`) draws one capital letter (first letter or digit of the title,
  any script) on a flat tile, with no author text. The tile is one of `MONOGRAM_COLORS` (12 pairs, white or near-black text,
  every pair 7:1 or better, so AA in all four themes and in high contrast), chosen from the title (`monogramIndex`), so a book
  keeps its colour. The letter is centred and sized in container units; badges stay in the corners (audio top-right,
  favorite bottom-left, finished bottom-right), so nothing collides. In high contrast the cover gets a real 2 px edge so a dark
  tile on a black page still reads as an object. A broken image falls back to the monogram. A title with no letter falls back to
  the title card. `BookDetailSheet` keeps its big title card (it has room for the title and author).
* **Covers show whole**: `.pn-cover__img` is `object-fit: contain` by default. A picture that is not 2:3 is letterboxed on
  the neutral tile; the box stays 2:3, so there is no layout shift.
* **`BookDetailSheet onEdit?(book)`**: adds "Edit details" (pencil) to the ⋯ menu, before "Remove from library". Without
  `onEdit` the menu is unchanged; without both, there is no menu. Esc inside the open menu closes only the menu (focus returns to
  ⋯); the next Esc closes the sheet (`BottomSheet` now leaves Esc to an open `role="menu"`).
* **Design Review 2**: onboarding is a picture panel plus a content column (side by side from 768 px, vertically balanced; on
  a phone the picture panel takes the spare height), so no card ends in an empty lower half; every step has a picture and step 2
  keeps the visual sample-book card. Settings sections are separate cards (Appearance, Reading, Install help, Storage used,
  About). The Install help intro says "offline" once ("…open full screen and work offline." or "…open full screen. Ready to
  use offline.").
* Gallery: `?screen=covers` (monograms with every badge, and square/wide/tall pictures shown whole); `detail*` screens now show the ⋯ menu with both rows.
* Library wiring after this branch (read-only check on integrate-2; `virtual.ts` and `icons.tsx` are already gone there):
  1. `src/features/library/components/BookList.tsx`: `import { VirtualList, useLibraryGrid, type RectLike } from '@/ui'` (drop the `@/ui/screens/libraryGrid` deep import).
  2. `src/features/library/library.css`: delete the two last blocks, "Real covers are shown whole" (`.pn-bookcard .pn-cover__img`) and "Generated covers in library cards" (every `.pn-bookcard .pn-cover--generated …` rule). `BookCard` now draws the monogram and the whole cover itself, so nothing else changes in `BookItem`.
  3. `src/features/library/components/LibraryScreen.tsx` (the lazy `BookDetailSheet`): pass `onEdit={(book) => …}` to get "Edit details" before "Remove from library"; leave it out until the edit sheet exists.

### Audio player: bookmarks and skip lengths (`feature/ui-audio-bookmarks`)

Matches `src/engines/audio/types.ts` (`AudioController.skip/seekTo/setOptions`, `AudioOptions.skipBackSec/skipForwardSec` = 10, 15, 30 or 60)
and `src/data/schema.ts` (`BookmarkRecord { id, label, locator: { kind: 'audio', trackIndex, positionSec }, createdAt }`). Nothing in those files changed.

* **Bookmark chip**: `onAddBookmark?(positionSec)` shows a "Bookmark" chip in the secondary row (Speed, Sleep, Bookmark, Chapters). `positionSec` is
  seconds from the start of the book (add the track's `startOffsetSec` when you build the locator). A polite status says "Bookmark added at 1:02:03".
* **Bookmarks list**: `bookmarks?: PlayerBookmark[]` (`{ id, positionSec, label?, chapter? }`, exported type) adds "Bookmarks (n)" to a ⋯ menu in the
  player header. It opens `BookmarksSheet` (time, label or "Bookmark", chapter, in book order; tap to seek and close; trash button when
  `onDeleteBookmark?(bookmark)` is given, no confirm step so the app can offer Undo; an empty state; "Add bookmark here" when adding is possible).
  `onOpenBookmarks?()` replaces the built-in sheet when the app wants its own list.
* **Skip lengths**: `skipBackSeconds` (default 15) and `skipForwardSeconds` (default 30) name the buttons ("Back 15 seconds") and show the number in the glyph.
  With `onSkipIntervalChange?(direction, seconds)` the user can hold a skip button (500 ms), use the context-menu key or a right click, or pick
  "Skip buttons" in the ⋯ menu, to open a sheet with two radio groups. The app stores the choice (`engine.setOptions({ skipBackSec })` or
  `{ skipForwardSec }`) and passes it back; the screen is controlled. `skipIntervals?` changes the choices (default `SKIP_INTERVALS` = 10, 15, 30, 60; the
  engine type has no 45, so add it to `AudioOptions` first if you offer it). Without `onSkipIntervalChange` the lengths are fixed and nothing about choosing appears.
* **`AudioPlayerController`** gained optional `skipBackSeconds`, `skipForwardSeconds`, `setSkipInterval`, `bookmarks`, `addBookmark`, `removeBookmark`, `openBookmarks` (the controller wins over the props).
* **Keyboard** (laptop, through the shared `useShortcuts`, so the app's remaps and the "ignored while typing / on a focused control" rules apply): Space plays or pauses, ← and → skip by the chosen lengths
  (`seekBack` / `seekForward`), **B** adds a bookmark (new `bookmark` action, default `B`). Each key works only when its handler was given, and all are off while a sheet is open; `shortcuts={false}` turns them off.
  For the "?" dialog use `descriptions={playerShortcutDescriptions(back, forward)}` (from `@/ui/screens`) so it reads "Back 10 seconds" for the chosen length.
* All new code is in the lazy audio screen chunk (`@/ui/screens/AudioPlayerScreen`); the initial bundle did not change. Gallery: `?screen=player` has bookmarks and skip lengths wired.
* App wiring: pass `controller` (or the props) from the audio store: `skipBackSeconds: options.skipBackSec`, `skipForwardSeconds: options.skipForwardSec`,
  `setSkipInterval: (d, s) => engine.setOptions(d === 'back' ? { skipBackSec: s } : { skipForwardSec: s })` (persist it in settings), `bookmarks` from the bookmarks store mapped to `PlayerBookmark`,
  `addBookmark: (sec) => …create a BookmarkRecord at the locator for sec (label '')` plus a snackbar with Undo, `removeBookmark` with Undo.

### Collections and Stats (wire-ready, presentational)

`import { CollectionsScreen, StatsScreen, CollectionNameSheet, CollectionBooksEmpty } from '@/ui/screens'` (lazy routes only).
Gallery: `collections`, `collections-empty`, `collections-loading`, `collections-new`, `collections-shelf-empty`, `stats`,
`stats-empty`, `stats-loading`. Empty states use `Illustration` (`shelf`, `books`, `chart`).

**Wiring `src/app/pages/CollectionsPage.tsx` (or the Library bot's `CollectionsScreen` body):**
1. Map shelves to `CollectionShelf[]` = `{ id, name, bookCount, covers?: string[] }` (`covers` = up to four cover URLs of the
   shelf's first books; leave out for the shelf icon). Pass `loading` while `shelves === undefined`.
2. `<CollectionsScreen shelves loading onOpenShelf onOpenSmart onCreate onRename onDelete onMove notice />`.
   `onMove(shelf, -1 | 1)` replaces the four inline icon buttons (Rename, Move up/down and Delete live in one "⋯" menu per row;
   the first shelf has no "Move up", the last no "Move down"). `smart` defaults to Unfinished and Recently added
   (`DEFAULT_SMART_COLLECTIONS`, ids `unfinished` and `recent` to map to your presets).
3. New and Rename: keep `naming` state and render `<CollectionNameSheet open mode name onNameChange onSubmit onClose error busy />`
   (the sheet blocks blank names; trim and validate in the data layer; pass its message as `error`).
4. An opened shelf with no books: `<CollectionBooksEmpty name action />`. Delete keeps its snackbar undo.
5. Delete the page's own `ShelfRow`/Tailwind row markup and `LibIcon` imports (use `Icon` names `pencil`, `trash`).

**Wiring `src/app/pages/StatsPage.tsx`:** keep `data.stats(Date.now())` and the visibility refresh, then render
`<StatsScreen loading={summary === undefined} minutesPerDay={summary.minutesPerDay} dayLabels={short weekday names} dayNames={long weekday names} sessionCount={summary.sessionCount} finishedBooks={summary.finishedBooks} emptyAction={{ label: 'Open your library', icon: 'library', onClick: goToLibrary }} />`.
Labels as today: `new Date(Date.now() - (6 - i) * DAY_MS).toLocaleDateString(undefined, { weekday: 'short' | 'long' })`.
The screen draws its own header ("Stats"); drop `PageHeader` there. Bars are scaled with `transform` from a CSS variable,
so nothing lays out while they grow, and each bar is read as "Wednesday: 35 min" (today as "Today: ...").

### Long lists: VirtualList (one windowing implementation)

`VirtualList` (`components/VirtualList.tsx`, geometry in `utils/virtual.ts`) draws only the rows near the screen, so
5,000 books cost the same to scroll as 30. Props: `items`, `renderItem(item, index)`, `getKey`, `columns` (a number, or a
function of the list width: use `autoColumns(width, minItemWidth, gap)` for the CSS auto-fill rule), `gap`, `rowGap`,
`rowHeight` (fixed, exact scrolling) **or** measured rows with `estimatedRowHeight` (rows not drawn yet use the average
of the measured ones, rows re-measure when text size or width changes), `overscan` (rows, default 3), `scroller`
(`window` default, or `self` for a box with its own height), `scrollPaddingTop` (sticky headers), `role` (`list` or
`listbox`), `keyboardNav`, `initialSize`, `onRangeChange`. A ref gives `scrollToIndex(i, {align})` and `focusItem(i)`.

- Rows move with `transform: translate3d`, never `top`; rows are `role="presentation"`, items are `listitem` (or
  `option`) with `aria-posinset` and `aria-setsize` for the whole set ("12 of 4800").
- Keyboard: Tab walks the drawn items; the focused item and its neighbouring rows stay drawn even when scrolled far away;
  arrows move by item or row, Home/End jump to the first/last item, Page Up/Down move a screenful; text fields inside
  items keep their keys; at the edges the key is not swallowed, so the page still scrolls.
- `LibraryScreen` uses it only when there are more than `virtualizeAbove` books (default `LIBRARY_VIRTUALIZE_ABOVE` = 60);
  smaller libraries render the plain CSS grid. `screens/libraryGrid.ts` mirrors the CSS grid (9/10/11/12 rem minimums,
  the same gaps per breakpoint), so the windowed grid is pixel-identical to the plain one.
- The Library feature's own `useWindowVirtual` (`src/features/library/virtual.ts`) is a second implementation of the same
  idea; recommendation: Library adopts `VirtualList` and deletes it (same geometry: columns from auto-fill, row pitch,
  overscan; plus keyboard, ARIA set size, measured rows and focus retention).

### Motion rule

CSS transitions and keyframes may only change `transform`, `opacity` (and `translate`, `scale`, `rotate`). Colors, borders,
shadows and sizes swap instantly. `styles/motion-rules.test.ts` fails otherwise, for `src/ui` and every other stylesheet
under `src`; the documented `MOTION_ALLOW_LIST` there (file, selector, property, reason; stale entries fail) is empty today.

### High contrast (blueprint 5.8)

`ThemeProvider` takes `contrastMode` ("system" | "standard" | "high", default "system" = `prefers-contrast: more`),
`onContrastModeChange`, and writes `data-contrast` next to `data-theme`; `ThemeScope contrast="high"` forces a subtree.
Every theme x high contrast keeps text at 7:1 or better and non-text at 3:1 or better (computed from `tokens.css` in
`styles/contrast.high.test.ts`). The accents stay in the **teal family** (dark teal on Light and Sepia, light teal on
Dark and Black; a test checks the hue), so high contrast looks like the same app, not another one.
**Custom + high contrast**: `resolveCustomTheme(input, 'high')` (the provider does it when `mode="custom"`) raises every
text pair to `textTarget`: 7:1 whenever the chosen page color can give black or white 7:1, otherwise the best the page
allows and never below AA; strong borders 4.5:1, hairlines 3:1, focus ring in the text color, stronger scrim.
`SettingsScreen` shows a "Contrast" row when `contrastMode` and `onContrastModeChange` are passed.
App: persist the contrast setting next to the theme and pass both to `ThemeProvider`.

### Text size is rem-only

All `--pn-text-*` tokens are `rem`. The app sets ONE value, `--pn-font-size`, through `applyTextSize(px)` (14 to 32,
that is 87.5% to 200%), and `html { font-size: var(--pn-font-size) }` does the rest. Do not write `--pn-text-*` from
the app. `TEXT_TOKEN_PX` is gone. Tab bar labels are the full `--pn-text-xs` (12 px at 100%, 24 px at 200%, never capped or cut): four tabs sit in one row while each can hold "Collections" (container width above 21 rem, so it follows the text size), otherwise two rows of two; the bar grows, `AppShell` measures it (`--pn-bottom-chrome`), so content and the mini-player stay above it, and the safe-area inset stays under the labels.

### Wiring checklist for `src/app` (the designer does not edit it)

1. `src/app/font-size.ts`: `FONT_SIZE_MAX` 24 to 32 (use `TEXT_SIZE_MAX`); `apply-theme.ts`: call `applyTextSize` and stop writing the px tokens.
2. Theme: add `custom` to the saved preference plus a saved `customTheme` (`{ page, text, accent }`, parse with `parseCustomTheme`); pass `mode` and `customTheme` to `ThemeProvider`.
3. Replace `ThemeSwatches` and `FontSizeControl` with `ThemePicker` and `TextSizeControl`, or mount `SettingsScreen` (lazy).
4. Onboarding: `OnboardingScreen`; pass `starter` only when `sampleBook.available()` and map the import result to `busy` / `error`; drop the "arrives in the next release" copy.
5. Library: `LibraryScreen` (`onAdd` only when adding works); the empty library shows the starter card when `starter` is given.
6. Settings: `<SettingsScreen install={<InstallHelp />} />`; mount `<PwaPrompts />` once inside the theme provider.
7. Load every screen with `React.lazy` and prefetch the tab chunks on idle after launch (first visits to a lazy tab are the slowest taps).

## Screens (`screens/`, props and callbacks only)

| Screen | What the app passes |
|---|---|
| `LibraryScreen` | `books: BookSummary[]` (already filtered), `loading`, `filter` + `onFilterChange`, `query` + `onQueryChange`, `onOpenBook(book, coverRect)`, `onAdd?`, `emptyActions?`, `starter?`, slots `resume`, `hint`, `notice` |
| `BookDetailSheet` | `open`, `book: BookDetail`, `onClose`, `originRect` (the cover grows out of its card), `onRead`, `onListen`, `onEdit?` (adds "Edit details" to the ⋯ menu), `onRemove` (the app answers with a `ConfirmDialog`). Tinted from the cover. Bottom sheet on phones, two panes from 1024 px |
| `ReaderScreen` + `ReaderSettingsSheet` | title, chapter, progress, `settings: ReaderSettings`, `fonts`, `onSettingsChange`, `settingsOpen` (the "Aa" sheet: size, font, page color, line spacing, margins, with a live sample), children = the page |
| `AudioPlayerScreen` | `book`, then either `controller` or `playing`, `position`, `duration`, `speed`, `sleepLabel`, handlers. Time left is shown at the chosen speed ("4 h 28 min left at 1.25×"). Tinted from the cover |
| `VoiceStudioScreen` | `voices: VoiceOption[]`, `selectedId`, `onSelect`, `onPreview`, `onNext` (step 1 of 3, Next pinned to the bottom) |
| `OnboardingScreen`, `SettingsScreen` | see "Typed props of the new screens" above |

Data never lives here: the types are in `types.ts` (`BookSummary`, `BookDetail`, `ReaderSettings`, `VoiceOption`, `HintStore`).

**Cover tint** (`useCoverTint`, `tintForTheme`): the dominant color of the cover is found from a 24 x 24 downscale
(`createImageBitmap` with resize, so decoding stays off the main thread), memoized per URL, then clamped so the
text, muted, link, accent-ink and danger colors stay at least 4.5:1 on the tinted surface in every theme (tested).
The tint is a `::before` layer whose opacity is set, nothing repaints per frame.

**Shared transitions**: `playFlip` grows the cover from its card with transform and opacity only (Web Animations
API) and is skipped under reduced motion. Sheets follow the finger and spring back with `--pn-ease-spring`.

## BottomSheet history contract

- Opening a sheet pushes one history entry whose state carries a unique key (`pnSheet`), merged into the router's state.
- The **system back gesture closes the top sheet first**, before any route change. Stacked sheets close newest first.
- Closing a sheet any other way (Esc, scrim, button, swipe, or unmounting) removes its entry again with `history.back()`,
  **but only if that entry is still the current one**. If the screen navigated while the sheet was open, nothing is undone.
- Dragging writes `--pn-sheet-drag` from `requestAnimationFrame` (transform only) and never re-renders; `will-change` is
  set only while the sheet moves. The motion duration is read once per open or close.

## AppShell

```ts
interface AppShellProps {
  items: readonly NavItem[];
  value: string;
  onSelect: (id: string) => void;
  chrome?: 'full' | 'immersive';   // default 'full'
  hidden?: boolean;                // alias for chrome="immersive"; chrome wins if both are set
  showMiniPlayer?: boolean;        // default: true for 'full', false for 'immersive'
  miniPlayer?: ReactNode;
  railHeader?: ReactNode;
  railFooter?: ReactNode;
  children?: ReactNode;
}
```

- `full`: rail from 768 px, tab bar below it, mini-player above the tab bar (phone) or docked at the bottom (laptop).
- `immersive` (reader, full player): renders **neither the rail nor the tab bar**; the content fills the viewport and
  takes the safe-area insets (`env(safe-area-inset-*)`). `data-chrome="immersive"` is set on `.pn-shell`, which also zeroes
  `--pn-rail-width`, so no CSS rules on `.pn-rail` or `.pn-shell__bottom` are needed in the app.
- The content element is never remounted when `chrome` changes (state and scroll survive), and `--pn-bottom-chrome` goes to `0px`.
  There are no transitions on the chrome (nothing animates, so reduced motion is trivially respected).
- Keep the mini-player on an immersive route with `showMiniPlayer`.
- The bottom chrome height is published as `--pn-bottom-chrome` from the observed border box, batched to one write per frame.

## Laptop (768, 1024, 1280, 1440 px; phone layouts unchanged)

- Left rail 232 px from 1024 px; library grid is `auto-fill` (columns have rem minimums, so 200 % text gives one phone column);
  reading column 60 to 75 characters; book detail is a two-pane dialog; the player is two columns; the mini-player is a bar
  docked at the bottom of the content area.
- Breakpoints live in `utils/media.ts` (`BREAKPOINTS`, `useMediaQuery`, `useMinWidth`), the same values as the CSS.
- **Shortcuts**: `ShortcutsProvider` (app-wide handlers and the "?" help dialog) and `useShortcuts(handlers, { bindings, enabled })`.
  Defaults: Space play/pause, ← → seek or page, `j`/`k` next/previous, `/` search, `t` theme, Esc close, `?` help.
  Remap with `bindings={{ next: ['n'] }}`; an empty array turns an action off. Ignored while typing in a field, with Ctrl, Alt
  or Meta held, and for Space or arrows when a button or link has focus.
- Hover states change opacity only (an overlay), never layout; every interactive element has a visible `:focus-visible` ring.

## Dev gallery (never in production)

`demo/gallery.html` renders every screen with sample content (16 books, generated SVG covers, long titles, missing
covers, 0 % and 100 %). With `npm run dev` open
`/src/ui/demo/gallery.html?screen=library&theme=dark&scale=1` (`screen`: see `GALLERY_SCREENS`; `theme`: light, sepia,
dark, black; `scale`: 1 to 2 for text size; `motion=reduce`). It is its own HTML entry that the build does not include, and
`gallery-main.tsx` refuses to run unless `import.meta.env.DEV`. Sample data exists only in `demo/`; tests fail if anything
else imports it or if `index.ts` exports it. After a build, `grep -r "Marguerite Aldous" dist` finds nothing.

## App icon and splash (`assets/`)

SVG sources: `icon.svg`, `icon-full-bleed.svg`, `icon-maskable.svg`, `splash-light.svg`, `splash-dark.svg`.
`node src/ui/assets/render-assets.mjs` renders `assets/generated/`: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
`apple-touch-icon-180.png`, `splash-{light,dark}-{1170x2532,1290x2796}.png`. The app owner places them (see the report).

## PWA install and update UI (`pwa/`)

Presentational pieces (props only): `InstallHelpSheet`, `IosInstallSheet`, `IosInstallSteps`, `InstallBanner`, `UpdateAvailableSnackbar`.
Connected wrappers that import `@/sw` (the only place `src/ui` does):

- `<InstallHelp />` renders the "Install help" button and its dialog (role=dialog, aria-modal, Close and Done buttons, focus trap, focus returns to the button). It reads `useInstall()` and `usePersistence()`. Put it in Settings in place of the old `Button` + `IosInstallSheet`.
- `<PwaPrompts isPlaying installOfferReady />` mounts once inside the theme provider, beside the app frame. It shows the update notice (`useUpdatePrompt(isPlaying)`: Refresh when idle, "next launch" with no Refresh while audio plays), the install banner (once, after `installOfferReady`) and the iPhone 3-step sheet (iOS only, once). Pass `isPlaying` from the player state and set `installOfferReady` after the first book is opened or finished.

## Performance notes

Animated properties are transform and opacity only. Skeleton shimmer is a translated pseudo-element (static under reduced
motion). One `Rail` or `TabBar` in the DOM. Sheet drag, resize measurement and history handling are described above.

All interactive controls are at least 44 x 44 px, have a visible `:focus-visible` ring, and a screen-reader name.

## Demo page (dev only)

`demo/UiKitDemo.tsx` shows every component in every theme with a theme switcher and a contrast toggle (System, Standard, High contrast). It is not exported from
`index.ts`, so production bundles do not include it. The Architect mounts it in the router like this
(only the app code outside `src/ui` changes):

```tsx
import { lazy, Suspense } from 'react';
const UiKitDemo = lazy(() => import('@/ui/demo/UiKitDemo'));

// in the route table:
...(import.meta.env.DEV
  ? [{ path: '/ui-kit', element: <Suspense fallback={null}><UiKitDemo /></Suspense> }]
  : []),
```

The demo uses a scoped theme, so it never fights the app's own theme setting.

## Using the tokens from `src/app/themes.ts`

Import the palette instead of keeping a second table:

```ts
import { THEME_PALETTE, THEME_SCHEME } from '@/ui/theme/palette';
// THEMES[name] = {
//   page: p.page, surface: p.surface, text: p.text, muted: p.muted, accent: p.accent,
//   onAccent: p['on-accent'], line: p.line, scheme: THEME_SCHEME[name],
// } with p = THEME_PALETTE[name]
```

## Tests

`npm test` runs everything under `src/ui`:

- `styles/contrast.test.ts`: WCAG ratios computed from `styles/tokens.css` for every theme (text pairs at least 4.5:1,
  focus ring, control borders and accent fill at least 3:1). Fails if any token drifts.
- `styles/contrast.high.test.ts`: the same computed check for all 8 theme x high-contrast combinations (text at least 7:1),
  CSS and `palette.ts` sync, the `prefers-contrast: more` block, thicker strokes.
- `theme/contrast.test.tsx`: contrast attribute and API behavior, system preference, scopes and portals.
- `styles/tokens.test.ts`: 4 px grid, radii, 150 to 250 ms motion, reduced motion, 44 px targets, breakpoints,
  palette in sync with CSS, self-hosted assets, no network code.
- `components/*.test.tsx`, `theme/theme.test.tsx`, `demo/UiKitDemo.test.tsx`: behavior and accessibility.

- `styles/design-rules.test.ts`: 4 px grid, two font families, three weights, one icon set, one accent per theme, font budget, demo isolation.
- `screens/screens.test.tsx`, `components/Redesign.test.tsx`, `utils/utils.test.ts`, `shortcuts.test.tsx`: screens by role and label, focus order, tint contrast on every theme, time-left, shortcuts.

User interaction in tests uses the real `@testing-library/user-event` (MIT, dev dependency).
