# features/player

Owner: **Audio** bot.

- `PlayerProvider` — single `HTMLAudioElement`, controller sync, keyboard shortcuts, optional wake lock.
- `miniPlayerSlot` — register on `AppServices.miniPlayerSlot` (`Component` + `useActive`); see `docs/ROUTE_CHROME.md`.
- `AudiobookPlayerScreen` — immersive `/listen/:id` UI (replace `src/app/pages/PlayerScreen.tsx`).
- `useIsPlaying()` — for PWA update prompt.

## Casey wiring (`src/app`)

1. `services.tsx`: `miniPlayerSlot` from `@/features/player`, wrap app in `<PlayerProvider>`.
2. `pages/PlayerScreen.tsx`: re-export `AudiobookPlayerScreen` (routes already use `BookRoute` → `PlayerScreen`).
3. `useUpdatePrompt(useIsPlaying())` where the update snackbar lives.
4. Library: build `AudioItem` from OPFS/`tracks` and call `loadAudiobookForBook` / `controller.load`.

Playback state must never live in the mini-player component; it unmounts on immersive routes.
