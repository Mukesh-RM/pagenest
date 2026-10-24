# Route chrome: the tab bar, rail and mini-player per screen

"Chrome" is the frame around a screen: the **tab bar** (phones), the **rail** (768 px and wider)
and the **mini-player**. Every route has one of two chromes:

| Chrome | What shows | Used by |
| --- | --- | --- |
| `full` | tab bar or rail, plus the mini-player when one is registered | Library, Collections, Stats, Settings |
| `immersive` | nothing: the screen has the whole window | `/read/:id`, `/listen/:id` |

The type is `RouteChrome` in `src/app/contracts/chrome.ts`.

## How it works

* `src/app/AppShell.tsx` is the layout of **every** route. It always renders the design system's
  frame, so a screen is never remounted when chrome changes, and it puts `data-chrome="full|immersive"`
  on a wrapper. `src/app/theme.css` hides the rail and the bottom bar (tab bar and mini-player) when
  that is `immersive`. The tab routes never change, so nothing on them can shift.
* Content padding is added by the frame on `full` routes only. An `immersive` screen draws edge to
  edge and owns its own margins, safe areas and background.
* While immersive, the design system publishes `--pn-bottom-chrome: 0px`, so snackbars and content
  stop leaving room for a bar that is not there.

## Route default (route table)

The default comes from the route definition, in `src/app/routes.tsx`:

```tsx
<Route path={READ_ROUTE} element={<RouteChrome chrome="immersive">{screen(<ReadScreen />)}</RouteChrome>} />
```

Routes without `<RouteChrome>` are `full`. Keep `<RouteChrome>` **outside** `Suspense`, so the frame is
already right while the screen's code loads.

## Screen override (hook)

A screen can change its own chrome while it is mounted:

```tsx
import { useRouteChrome } from '@/app/route-chrome';

export default function ReaderScreen({ book, position }: BookScreenProps) {
  useRouteChrome('immersive'); // or 'full'
  ...
}
```

* A screen beats the route default. If a screen is nested in another screen, the deepest wins; when
  it unmounts, the next one out takes over; with none left, the route default (or `full`) is back.
* Safe in React StrictMode, and safe when the value changes between renders.
* Switching chrome while a screen stays mounted changes the content padding (the frame adds it on
  `full` only), so a screen that toggles often should manage its own spacing instead.
* Reader and Audio owners who want chrome to come and go on a tap (for example "tap to show the
  controls") should draw their own overlay inside the immersive screen. The tab bar is for navigation between tabs.

Both book routes are `immersive` by route default, so the Reader and the Audiobook player draw their own top and bottom bars and
safe areas. Neither needs `useRouteChrome` unless it wants the tab bar back (for example an error screen that offers the Library tabs).

Under the hood: a small Zustand store, read with a selector (`useCurrentChrome`) that returns only
`'full'` or `'immersive'`. Only the frame re-renders when that answer changes.
Registration uses a layout effect, so there is no frame where the tab bar flashes on an immersive route.

## Mini-player (Audio owner)

The mini-player persists across the four tabs. The Audio owner supplies it as a `MiniPlayerSlot`
(`src/app/contracts/chrome.ts`) in `AppServices.miniPlayerSlot`:

```ts
const miniPlayerSlot: MiniPlayerSlot = {
  Component: AudioMiniPlayer,                       // renders the design system's MiniPlayer
  useActive: () => useAudio((s) => s.current !== undefined), // optional; selector, not the whole store
};
```

* Rendered **above the tab bar on `full` routes** only. Never on `immersive` routes.
* Not registered, or `useActive()` false: **no element and no reserved space**.
* Active: the slot is wrapped in a box of the mini-player's height (`--pn-miniplayer-height` plus its
  bottom margin), so it does not jump while the component starts up. The design system
  measures the whole bottom area and pads the content to match.
* It is a visual component only. It unmounts on immersive routes, so the audio element, playback state and
  timers must live in the audio controller (a service or store), never in the component. Its "expand" action
  navigates with `pathForBook` (see `docs/READER_ROUTES.md`).
* There is no registration yet in the app; until the Audio owner adds one, no mini-player shows.
  **Registration point:** `miniPlayerSlot` in the services object built in `src/app/services.tsx` (the Audio bot exports a ready-made
  `miniPlayerSlot` from `@/features/player`). `MiniPlayerHost` renders it on `full` routes only.

## For UI/UX

* The hiding rule targets the design system's class names `.pn-rail` and `.pn-shell__bottom`
  (`src/app/theme.css`). A `chrome` prop on `AppShell` would be cleaner; if one is added, delete the
  rule and pass the prop from `src/app/AppShell.tsx`. A test fails if the rule is changed by accident.
* Immersive screens do not get the page margin; they use `--pn-margin` and `--pn-safe-top` themselves.
