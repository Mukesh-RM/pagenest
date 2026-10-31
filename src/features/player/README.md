# features/player

Owner: **Audio** bot.

- `PlayerProvider` — single `HTMLAudioElement`, controller sync, keyboard shortcuts, optional wake lock.
- `miniPlayerSlot` — register on `AppServices.miniPlayerSlot` (`Component` + `useActive`); see `docs/ROUTE_CHROME.md`.
- `AudiobookPlayerScreen` — immersive `/listen/:id` UI (replace `src/app/pages/PlayerScreen.tsx`).
- `useIsPlaying()` — for PWA update prompt.

## Casey wiring (`src/app`)

1. `services.tsx`: `miniPlayerSlot` via `route-chrome` (not the player barrel); `PlayerProvider` mounts only on `/listen` (lazy `PlayerScreen`).
2. `pages/PlayerScreen.tsx`: re-export `AudiobookPlayerScreen` (routes already use `BookRoute` → `PlayerScreen`).
3. `useUpdatePrompt(useIsPlaying())` where the update snackbar lives.
4. Library: build `AudioItem` from OPFS/`tracks` and call `loadAudiobookForBook` / `controller.load`.

## Review / Playwright seed audiobook

The seed module is **not** in production builds. It is included when `import.meta.env.DEV` is true or when the app is built with **`VITE_PN_SEED_AUDIO=1`** (`npm run build:seed-audio`). Playwright (`tests/playwright.config.ts`) builds with that flag; CI `npm run build` does not, and `scripts/check-no-seed-in-dist.mjs` fails if `pn-review-seed-audiobook` or seed fixture names appear in `dist/`.

Open `/?pn_seed_audio=1` once (or visit `/listen/pn-review-seed-audiobook?pn_seed_audio=1`) to insert the CC0 synthetic book into IndexedDB, then go to `/listen/pn-review-seed-audiobook`. Regenerate fixtures with `node scripts/audio/generate-seed-audiobook.mjs`. Provenance: `src/features/player/fixtures/seed/PROVENANCE.md`.

Playback state must never live in the mini-player component; it unmounts on immersive routes.
