# Back gesture and sheets

Blueprint 5.5: "the system back gesture closes sheets first, then screens, never exits the app by accident."

Code: `src/app/back/` (Architect). Example user: `src/app/components/Sheet.tsx`.

## Use it (UI/UX and feature bots)

Every sheet gets one line. Put it in the component that owns the open state:

```tsx
import { useBackClose } from '@/app/back';

function Chapters() {
  const [open, setOpen] = useState(false);
  useBackClose(open, () => setOpen(false));
  // render the sheet when `open`
}
```

Or just use `<Sheet open onClose title>` from `src/app/components/Sheet.tsx`, which already calls it, and handles
Escape, backdrop tap, focus in and out, and Tab trapping. If `src/ui` ships its own sheet, call `useBackClose(open, onClose)`
inside it the same way.

Rules for `onClose`:

- It must close the sheet in the UI (set state to closed). It is called when the user goes back, and when a screen change
  drops every sheet.
- It is **not** called when your own code closes the sheet (Close button, Escape, backdrop). You already know.
- The latest `onClose` is always used; you do not need `useCallback`.

Nested sheets work: each back gesture closes the topmost. Closing a lower sheet in code while an upper one is open is fine.

## What it does

| Event | Result |
|---|---|
| Sheet opens (`open` becomes true) | One history entry is added (in a microtask) |
| Back gesture / browser back | The topmost sheet's `onClose` runs; the screen does not change |
| Sheet closed in code | Its history entry is removed with `history.go(-1)`; `onClose` does not run |
| Screen (route) changes while sheets are open | `AppShell` calls `dropAll()`: sheets close, history is left alone; the stale entries are skipped when the user reaches them |
| No sheet open, back gesture | Normal: the router goes to the previous screen |

## How it stays consistent

- `BackStack` (`back-stack.ts`) is plain TypeScript with no React, so it is easy to test with a scripted history.
- History entries only carry a depth number, `history.state.pnBackDepth` (they keep the router's own state keys). They
  never say which sheet they belong to, so closing any sheet in any order keeps the counts right.
- History is brought in line with the stack in **one microtask**. A sheet that is released and registered again in the same
  tick (React StrictMode: mount, unmount, mount) changes nothing in history.
- On `popstate`: if the entry's depth is lower than the number of open sheets, the topmost sheets close (one per entry left).
  If it is higher (forward into an entry whose sheet is gone, or back over entries left behind by a route change), the stack
  steps back over it automatically.
- Unmounting a component with an open sheet removes its entry (hook cleanup).

## Wiring (already done in `App.tsx`)

```tsx
<BrowserRouter>
  <BackStackProvider>
    <AppRoutes />   {/* AppShell calls stack.dropAll() on every route change */}
  </BackStackProvider>
</BrowserRouter>
```

`BackStackProvider` must be inside the router and above every screen that opens a sheet. In tests, `renderApp()` from
`src/app/test-utils.tsx` sets this up.

## Limits

- It cannot stop the browser or OS from leaving the app when there is no history left (first screen, back gesture). That is
  the browser's decision. Do not push extra entries to "trap" the user.
- Swipe-down-to-close (blueprint 5.7) is a gesture for the sheet component, not for this hook; it should just call `onClose`.
