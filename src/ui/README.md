# PageNest design system (`src/ui`)

Owned by the UI/UX designer. Implements blueprint section 5. Everything here is TypeScript + React,
plain CSS variables, no CDN: Inter (SIL OFL 1.1) and Lucide icons (ISC) are vendored in this folder
with their license files.

```ts
import { Button, Chip, Card, BottomSheet, TabBar, Rail, MiniPlayer, SnackbarProvider, useSnackbar,
         Skeleton, EmptyState, InstallBanner, IosInstallSheet, UpdateAvailableSnackbar } from '@/ui';
```

Importing `@/ui` also loads `styles/index.css` (font, tokens, component styles). It does not touch
`html`, `body` or the reset, so it is safe next to Tailwind.

## Tokens (`styles/tokens.css`, the single source of truth)

| Group | Tokens |
|---|---|
| Color (per theme) | `--pn-page`, `--pn-surface`, `--pn-surface-raised`, `--pn-text`, `--pn-muted`, `--pn-accent`, `--pn-on-accent`, `--pn-link`, `--pn-border-strong`, `--pn-line`, `--pn-focus-ring`, `--pn-danger`, `--pn-inverse-*` (snackbar), `--pn-skeleton*`, `--pn-scrim` + `--pn-scrim-opacity` |
| Space (4 px grid) | `--pn-space-1` (4) to `--pn-space-16` (64), `--pn-margin` (16, 24 from 768 px) |
| Shape | `--pn-radius-card` 12, `--pn-radius-sheet` 20, `--pn-radius-pill` |
| Type | `--pn-font-sans` (Inter), `--pn-text-xs/sm/md/lg/xl` = 12/14/16/20/28 |
| Motion | `--pn-duration-fast/base/slow` = 150/200/250 ms, `--pn-ease-out` |
| Touch | `--pn-touch` = 44 px |

Colors are space separated RGB triplets (`250 250 247`), the same format as the app shell and
Tailwind (`rgb(var(--pn-page) / <alpha-value>)`). In plain CSS write `rgb(var(--pn-page))`.
The shared names with `src/app` are `page, surface, text, muted, accent, on-accent, line`.

**Themes**: Light (default), Sepia, Dark, Black, selected with `data-theme="light|sepia|dark|black"` on any
element (document root for the app theme, a wrapper for the separate reader theme: `<ThemeScope theme="sepia">`).
"Follow the system" is a mode resolved in script: `resolveTheme('system', prefersDark)`.
Page, text and accent colors are exactly the blueprint 5.2 values.

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
| `Button` | primary / secondary / ghost / danger, `size="lg"`, `iconOnly` (requires `aria-label`) |
| `Chip`, `ChipGroup` | `selected` makes it a toggle (`aria-pressed`) |
| `Card`, `ProgressBar` | `onPress` makes it a button card; `onLongPress` (500 ms, right-click, context-menu key) for multi-select |
| `BottomSheet` | slides up 250 ms; closes on system back (popstate) first, Esc, scrim, swipe down, close button; focus trap, `aria-modal`, scroll lock, focus restore |
| `TabBar` / `Rail` / `AppShell` | phone bottom bar below 768 px, left rail from 768 px (CSS only); `href` items render real links |
| `MiniPlayer` | visual only, no audio; swipe up or tap to expand |
| `SnackbarProvider` + `useSnackbar().show({ message, onAction, onDismiss })` | Undo for 8 s, pauses on hover/focus, one at a time |
| `UpdateAvailableSnackbar` | props-only "New version ready" with Refresh and Dismiss |
| `InstallBanner` | props-only Android banner with Install and Not now |
| `IosInstallSheet` | props-only three-step sheet (Share, Add to Home Screen, Add) on `BottomSheet` |
| `Skeleton`, `SkeletonCard`, `SkeletonGroup` | group announces "Loading" once |
| `EmptyState` | title, description, one action |
| `Icon` | vendored Lucide, 24 px outline, decorative unless `label` is given |

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

User interaction in tests uses the real `@testing-library/user-event` (MIT, dev dependency).
