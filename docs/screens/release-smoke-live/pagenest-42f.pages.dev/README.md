# Live release smoke @ pagenest-42f.pages.dev

360×740 Playwright profiles (`release-smoke-chromium` = Pixel 7, `release-smoke-webkit` = iPhone 14).

Run:

```bash
npm run smoke:live -- https://pagenest-42f.pages.dev/
```

## Deploy `0fbf413` smoke (2026-11-02) — **all green**

Production includes `cad50b3` (no CSP `frame-ancestors`) + library segments (`663d74f`). Bundle: `main-CaS_SA7T.js` / `engine-foliate-CVVxng76.js`.

| Phase | Chromium | WebKit |
|-------|----------|--------|
| Upgrade | **PASS** | **PASS** |
| Core | **PASS** | **PASS** |
| OPFS blocked | skip (live) | skip (live) |
| Read-aloud (device) | **PASS** | **PASS** |
| Read-aloud (legacy Piper) | **PASS** | **PASS** |

**WebKit upgrade note:** After the first open in a persistent profile, WebKit + the service worker can emit a one-shot `TypeError: Importing a module script failed` pageerror while the reader still renders; live smoke treats it as benign (`release-smoke-console.ts`) and uses `page.goto(same URL)` instead of `reload()` before the library reopen leg.

### Screenshot paths (this folder)

**Upgrade:** `release-smoke-{chromium|webkit}-upgrade-01-import.png`, `-02-epub-open.png`, `-03-after-reload.png`

**Core:** `release-smoke-{chromium|webkit}-01-library.png` … `-09-all-formats-after-sw-bump.png` (includes `-03-epub-open.png`, `-03b-epub-tap-turn.png`, PDF/audio/SW bump)

**Read-aloud device:** `release-smoke-{chromium|webkit}-read-aloud-01-reader.png` … `-05-controls.png`

**Read-aloud legacy:** `release-smoke-{chromium|webkit}-read-aloud-legacy-01-reader.png`, `-legacy-02-audible.png`

## Deploy `663d74f` smoke (2026-11-02) — WebKit red (pre–`frame-ancestors` fix deploy)

| Phase | Chromium | WebKit |
|-------|----------|--------|
| Upgrade | **PASS** | **FAIL** — foliate 240s |
| Core | **PASS** | **FAIL** — foliate 240s |
| Read-aloud | not run | not run |

Fixed by **`cad50b3`** (#39): omit CSP `frame-ancestors`; keep `X-Frame-Options: DENY`.

## Prior merges on this host

| SHA | Notes |
|-----|--------|
| `0fbf413` | Live smoke docs + Chromium shots (#38) |
| `cad50b3` | CSP: omit `frame-ancestors` for WebKit blob EPUB (#39) |
| `663d74f` | All / Books / Audio segments (#37) |
| `b7ec1fc` | CSP/COOP scoped to HTML routes only (#36) |
