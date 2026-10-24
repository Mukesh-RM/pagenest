# PageNest design system (`src/ui`)

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
| `BookCover`, `BookCard` | cover or generated title card (8 AA color pairs, stable per title), title (2 lines), author (2 lines), progress bar, headphone badge for audio, check badge at 100 % |
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

## Screens (`screens/`, props and callbacks only)

| Screen | What the app passes |
|---|---|
| `LibraryScreen` | `books: BookSummary[]` (already filtered), `loading`, `filter` + `onFilterChange`, `query` + `onQueryChange`, `onOpenBook(book, coverRect)`, `onAdd`, slots `resume`, `hint`, `notice` |
| `BookDetailSheet` | `open`, `book: BookDetail`, `onClose`, `originRect` (the cover grows out of its card), `onRead`, `onListen`, `onRemove` (the app answers with a `ConfirmDialog`). Tinted from the cover. Bottom sheet on phones, two panes from 1024 px |
| `ReaderScreen` + `ReaderSettingsSheet` | title, chapter, progress, `settings: ReaderSettings`, `fonts`, `onSettingsChange`, `settingsOpen` (the "Aa" sheet: size, font, page color, line spacing, margins, with a live sample), children = the page |
| `AudioPlayerScreen` | `book`, `playing`, `position`, `duration`, `speed`, `sleepLabel`, handlers. Time left is shown at the chosen speed ("4 h 28 min left at 1.25×"). Tinted from the cover |
| `VoiceStudioScreen` | `voices: VoiceOption[]`, `selectedId`, `onSelect`, `onPreview`, `onNext` (step 1 of 3) |

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

## Performance notes

Animated properties are transform and opacity only. Skeleton shimmer is a translated pseudo-element (static under reduced
motion). One `Rail` or `TabBar` in the DOM. Sheet drag, resize measurement and history handling are described above.

All interactive controls are at least 44 x 44 px, have a visible `:focus-visible` ring, and a screen-reader name.

## Demo page (dev only)

`demo/UiKitDemo.tsx` shows every component in every theme with a theme switcher. It is not exported from
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
- `styles/tokens.test.ts`: 4 px grid, radii, 150 to 250 ms motion, reduced motion, 44 px targets, breakpoints,
  palette in sync with CSS, self-hosted assets, no network code.
- `components/*.test.tsx`, `theme/theme.test.tsx`, `demo/UiKitDemo.test.tsx`: behavior and accessibility.

- `styles/design-rules.test.ts`: 4 px grid, two font families, three weights, one icon set, one accent per theme, font budget, demo isolation.
- `screens/screens.test.tsx`, `components/Redesign.test.tsx`, `utils/utils.test.ts`, `shortcuts.test.tsx`: screens by role and label, focus order, tint contrast on every theme, time-left, shortcuts.

`test/user.ts` is a tiny stand-in for `@testing-library/user-event` (not a project dependency).
