# features/player

Owner: **Audio** bot. `PlayerProvider` (single audio element), mini-player host, full-player sheet, `/listen/:id` route component, Zustand `useIsPlaying`, dev fixture loader, keyboard shortcuts, and Playwright harness under `e2e/`.

Wire-up for Architect (not owned here):

- Wrap the app in `<BrowserRouter>`, then `<PlayerProvider>`, routes, and `<PlayerChrome />` (mini + full player; needs the router).
- Pass floating mini-player UI into `AppShell` via `miniPlayer={<PlayerChrome />}` or mount chrome globally above the tab bar.
- Register `<Route path="listen/:id" element={<ListenRoute />} />`.
- Pass `useIsPlaying()` into `useUpdatePrompt` from `@/sw/hooks`.
