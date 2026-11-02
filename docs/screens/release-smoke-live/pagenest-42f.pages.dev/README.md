# Live release smoke @ pagenest-42f.pages.dev

360×740 Playwright profiles (`release-smoke-chromium` = Pixel 7, `release-smoke-webkit` = iPhone 14).

Run:

```bash
npm run smoke:live -- https://pagenest-42f.pages.dev/
```

## Deploy `663d74f` smoke (2026-11-02)

Production at `663d74f` (`b7ec1fc` asset headers + `#37` library segments). Bundle unchanged: `main-CaS_SA7T.js` / `engine-foliate-CVVxng76.js`.

| Phase | Chromium | WebKit |
|-------|----------|--------|
| Upgrade | **PASS** | **FAIL** — foliate 240s (“Still opening…”) |
| Core | **PASS** | **FAIL** — foliate 240s |
| OPFS blocked | skip | skip (suite exited on WebKit) |
| Read-aloud (device) | not run | not run |
| Read-aloud (legacy Piper) | not run | not run |

**Root cause (WebKit, live):** Document CSP still included `frame-ancestors 'none'`. WebKit refuses blob EPUB iframe loads (`Refused to load blob:… frame-ancestors`). **Fixed on `main` in `cad50b3` (#39)** — drop `frame-ancestors` from CSP; keep `X-Frame-Options: DENY`. Deploy `cad50b3` and re-run `smoke:live` for full green.

**Screenshots:** Chromium full core + upgrade paths in this folder. WebKit: library / import / upgrade-import only (foliate never opened).

## Deploy `109a37b` smoke (2026-11-01)

| Phase | Chromium | WebKit |
|-------|----------|--------|
| Upgrade | **PASS** | **FAIL** — foliate 240s |
| Core | **PASS** | **FAIL** — foliate 240s |

Asset CSP/COOP on `/assets/*` fixed in **`b7ec1fc`**.

## Prior merges on this host

| SHA | Notes |
|-----|--------|
| `cad50b3` | CSP: omit `frame-ancestors` for WebKit blob EPUB (#39) — merge pending deploy |
| `663d74f` | All / Books / Audio segments (#37) |
| `b7ec1fc` | CSP/COOP scoped to HTML routes only (#36) |
| `109a37b` | WebKit foliate bootstrap + sandbox strip (#35) |
