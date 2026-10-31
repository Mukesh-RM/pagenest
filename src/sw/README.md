# src/sw: service worker, install and update flow

Owner: Shell and PWA. Blueprint sections 5.6, 6, 14 and 15. Everything here is quiet by design: nothing interrupts a playing book.

| File | What it does |
|---|---|
| `sw.ts` | The service worker: precaches the app shell, falls back to `index.html` for every page request (offline launch), caches non-precached fonts on first use, waits for the page before updating, receives the Android Share Target POST |
| `register.ts` | `registerServiceWorker()`: registers the worker (production builds only), listens for the install events, checks for a new version when the app returns to the foreground (at most every 6 hours) |
| `pwa-store.ts` | Zustand store with the PWA state (update waiting, offline ready, install event, installed, persistence answer) |
| `hooks.ts` | The hooks other features use (below) |
| `update-flow.ts`, `install.ts`, `persist.ts`, `font-cache.ts`, `share-target.ts` | Small pure modules with unit tests |
| `e2e/` | Playwright tests for the built app: offline launch, precache, update waits, share target, no foreign requests. Run `npm run test:e2e:sw` |

Public entry: `import { ... } from '@/sw'`.

## How the pieces are wired (already done)

- `index.html` head: viewport-fit=cover, theme-color (default plus light and dark media tags), manifest, icons, Apple tags.
- `src/main.tsx` calls `registerServiceWorker()` once before rendering.
- `vite.config.ts` has the `VitePWA` block (injectManifest, `registerType: 'prompt'`, no manifest generation). `public/manifest.webmanifest` is the manifest; `public/_headers` holds the Cloudflare Pages headers and the CSP.

## What other owners must wire

**src/ui (UI/UX): update notice, install banner, iPhone sheet**

```tsx
import { useInstall, useUpdatePrompt } from '@/sw';

const { ui, applyUpdate, dismiss } = useUpdatePrompt(isPlaying); // isPlaying comes from the audio controller
// ui.kind === 'refresh'     -> quiet snackbar "New version ready, refresh" with a Refresh button (onClick: applyUpdate)
// ui.kind === 'next-launch' -> "New version ready. It will apply the next time you open PageNest." with NO button
// ui.kind === 'none'        -> render nothing

const { canInstall, showIosSteps, installed, install } = useInstall();
// canInstall    -> Android/desktop: show the banner (after the first book is added) and the Settings button; install() on tap
// showIosSteps  -> iPhone/iPad Safari, not installed: one-time sheet with 3 steps (Share, Add to Home Screen, Add)
// installed     -> hide both
```

**Audio (src/features/player)**: expose a boolean "is audio or read-aloud playing" for `useUpdatePrompt`. While it is true the notice has no Refresh button, so a reload can never cut playback.

**Library (src/features/library)**: on startup, and when the URL has `?share=<n>`, call `takeSharedFiles()` from `@/sw`. It returns the files shared from Android (oldest first) and empties the inbox; import them like picked files, then `history.replaceState` to remove `?share`. Call `requestPersistence()` (or `usePersistence().request()`) after the first successful import.

**Settings (src/app/pages/SettingsPage.tsx and later features)**: a persistence row using `usePersistence()` (`result.persisted`, `usageBytes`, `quotaBytes`); an Install button using `useInstall()`; an "Install help" button that opens the bottom sheet (`role="dialog"`, `aria-modal="true"`, Close button, closes on Escape and on the back gesture) with the iPhone steps. `useOfflineReady()` is true once the app is fully cached ("Ready to use offline").

## Update rules (blueprint 14)

1. A new worker installs and waits. It never calls `skipWaiting()` on install and does not claim pages that already depend on an older worker. The one exception is the very first install: `clients.claim()` on activate so the first visit can cache lazy engines and the sample book without a reload.
2. The page shows the notice; Refresh posts `SKIP_WAITING` and reloads once. While audio plays there is no Refresh button.
3. If the notice is ignored, the new version applies by itself the next time the app is launched.

## Fonts

Only Inter and Literata (the default reading font) are precached: any built file whose name contains `inter` or `literata` and ends in `.woff2`. Every other font file is cached the first time it is used and then works offline. Keep self-hosted fonts same-origin (the CSP allows `font-src 'self'`).
