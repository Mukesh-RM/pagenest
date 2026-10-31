# InkQuiet

A free, installable, offline-first web app (PWA) for reading e-books and PDFs and listening to audiobooks, with background playback, read-aloud, expressive narration and Voice Studio (your own voice only).

- No login, no ads, no analytics, no payments, no backend.
- Your files and your voice never leave your device.
- MIT licensed.

The full specification is [docs/BLUEPRINT.md](docs/BLUEPRINT.md). Progress is tracked in [STATUS.md](STATUS.md) and design decisions in [DECISIONS.md](DECISIONS.md).

> Status: Phase 0 (Foundation) is in progress. The app is live at <https://pagenest-42f.pages.dev>, hosted on the Cloudflare Pages free plan (project `pagenest`, free `*.pages.dev` address). See [STATUS.md](STATUS.md) for progress and [docs/DEPLOY.md](docs/DEPLOY.md) for how it is deployed.

## Install (as a user)

1. Open <https://pagenest-42f.pages.dev> in your phone or desktop browser.
2. Android / Chrome: tap **Install**. iPhone / Safari: Share, then **Add to Home Screen**.
3. Launch it from your home screen. After the first load it works offline.

## Run locally (as a developer)

Requirements: Node.js 20+, npm 10+, git.

```bash
git clone https://github.com/Mukesh-RM/pagenest.git
cd pagenest
npm install
npx playwright install --with-deps   # first time (or npm run playwright:install); browsers for root and feature e2e
npm run dev        # start the Vite dev server
npm run build      # production build into dist/
npm test           # unit tests (Vitest)
npm run test:e2e   # end-to-end tests (Playwright; ports in docs/TESTING.md)
```

## Repository layout

```
src/
  app/          shell, routes, theme provider, install prompt
  ui/           design system
  features/     library, reader, player, narration, voice-studio, stats, settings
  engines/      pdf, epub, audio, tts, emotion
  data/         dexie schema, opfs files, backup and restore
  workers/      import, search, tts-render, audio-metadata
  sw/           service worker and update flow
tests/          unit and end-to-end tests
docs/           blueprint and figures
```

## Contributing rules

Conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). No secrets, model files or personal data in the repo. See `.cursor/rules/pagenest.mdc`.

## License

[MIT](LICENSE)
