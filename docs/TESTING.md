# Testing and E2E ports

InkQuiet runs several Playwright suites and a Lighthouse gate. Each suite can bind its own TCP port so parallel jobs do not collide. All local servers listen on `127.0.0.1`.

## Install browsers

From the repo root (once per machine or CI image):

```bash
npm run playwright:install
# same as: npx playwright install --with-deps
```

The QA package under `tests/` may install only Chromium and WebKit; see [tests/README.md](../tests/README.md).

## Port and base URL environment variables

When a **base URL** env is set, Playwright and Lighthouse **do not** start a local server; the port vars are ignored for that run.

| Variable | Read by | Default when unset | Notes |
| --- | --- | --- | --- |
| `PAGENEST_BASE_URL` | `tests/playwright.config.ts`, `tests/lighthouse/run.mjs` | (none) | Full origin + path prefix, e.g. `https://preview.example/` or `http://127.0.0.1:8080/`. Tests a deployed or already-running build. |
| `PAGENEST_E2E_PORT` | `scripts/e2e/resolve-port.mjs` (fallback for every row below) | Ephemeral free port on `127.0.0.1` | Set one port in CI when several suites run **sequentially** and you want a stable value; leave unset locally so each config picks a free port. |
| `PAGENEST_PORT` | `tests/playwright.config.ts`, `tests/fixtures/serve.mjs` (when port argv omitted) | → `PAGENEST_E2E_PORT` → free port | QA suite (`tests/`): `vite preview` of the production build. Legacy name; still supported. |
| `PAGENEST_LIBRARY_PORT` | `src/features/library/e2e/playwright.config.mjs` | → `PAGENEST_E2E_PORT` → free port | Library harness (`npm run test:e2e:library`). |
| `PAGENEST_LIBRARY_APP_PORT` | `src/features/library/e2e/playwright-app.config.mjs` | → `PAGENEST_E2E_PORT` → free port | Full-app library audio e2e (separate config; use when running in parallel with the harness). |
| `PAGENEST_READER_PORT` | `src/features/reader/e2e/playwright.config.mjs`, `src/features/reader/e2e/support/server.mjs` (when port argv omitted), `src/features/reader/e2e/support/perf.mjs` (when base URL argv omitted) | → `PAGENEST_E2E_PORT` → free port | Reader e2e (`npm run test:e2e:reader`). |
| `PAGENEST_SW_PORT` | `src/sw/e2e/playwright.config.mjs`, `src/sw/e2e/server.mjs` (when port argv omitted) | → `PAGENEST_E2E_PORT` → free port | Service worker e2e (`npm run test:e2e:sw`). |
| `PAGENEST_PLAYER_PORT` | `src/features/player/e2e/playwright.config.ts` | → `PAGENEST_E2E_PORT` → free port | Player harness (`playwright test -c src/features/player/e2e/playwright.config.ts`). |
| `PAGENEST_LIGHTHOUSE_PORT` | `tests/lighthouse/run.mjs` (when `--port` CLI flag omitted and `PAGENEST_BASE_URL` unset) | → `PAGENEST_E2E_PORT` → free port | Static server for `node tests/lighthouse/run.mjs` on `dist/` or `--dir`. CLI `--port` overrides env. |

Resolution order for each suite row (except `PAGENEST_BASE_URL`): **suite env → `PAGENEST_E2E_PORT` → free port**. Implementation: `scripts/e2e/resolve-port.mjs` (`resolveE2ePort`, `isE2ePortExplicit`).

When a suite or shared env is set, preview/vite commands add `--strictPort`; otherwise the chosen free port is already exclusive.

## Related (no TCP port)

| Variable | Read by | Purpose |
| --- | --- | --- |
| `PAGENEST_NO_SERVER` | `tests/playwright.config.ts` | Skip starting a server (unit project). |
| `PAGENEST_TARGET=fixture` | `tests/playwright.config.ts` | Serve `tests/fixtures/reference-app` via `tests/fixtures/serve.mjs`. |
| `PAGENEST_SKIP_BUILD` | `tests/playwright.config.ts` | Control whether the QA webServer runs `npm run build` before preview. |

## npm scripts (repo root)

| Script | Config |
| --- | --- |
| `npm run test:e2e` | Root re-export + `tests/playwright.config.ts` + player config |
| `npm run test:e2e:library` | `src/features/library/e2e/playwright.config.mjs` |
| `npm run test:e2e:reader` | `src/features/reader/e2e/playwright.config.mjs` |
| `npm run test:e2e:sw` | `src/sw/e2e/playwright.config.mjs` |
| `npm run playwright:install` | Installs Playwright browsers and OS deps |

Full QA workflow (Playwright projects, Lighthouse, perf gates) lives in [tests/README.md](../tests/README.md).
