# Live release smoke @ pagenest-42f.pages.dev

360×740 Playwright profiles (`release-smoke-chromium` = Pixel 7, `release-smoke-webkit` = iPhone 14).

Run:

```bash
npm run smoke:live -- https://pagenest-42f.pages.dev/
```

## Deploy **`67f4221`** live smoke (2026-11-02) — **all green**

Production includes SW chunk precache + import retry (#41). Upgrade spec asserts saved read position after reload.

| Phase | Chromium | WebKit |
|-------|----------|--------|
| Upgrade | **PASS** | **PASS** |
| Core | **PASS** | **PASS** |
| OPFS blocked | skip (live) | skip (live) |
| Read-aloud (device) | **PASS** | **PASS** |
| Read-aloud (legacy Piper) | **PASS** | **PASS** |

### Screenshot paths (this folder)

**Upgrade:** `release-smoke-{chromium|webkit}-upgrade-01-import.png`, `-02-epub-open.png`, `-03-after-reload.png`

**Core:** `release-smoke-{chromium|webkit}-01-library.png` … `-09-all-formats-after-sw-bump.png`

**Read-aloud device:** `release-smoke-{chromium|webkit}-read-aloud-01-reader.png` … `-05-controls.png`

**Read-aloud legacy:** `release-smoke-{chromium|webkit}-read-aloud-legacy-01-reader.png`, `-legacy-02-audible.png`

## Prior merges on this host

| SHA | Notes |
|-----|--------|
| `67f4221` | SW precache + stale chunk import retry (#41) |
| `0fbf413` | Live smoke docs (#38) |
| `cad50b3` | CSP: omit `frame-ancestors` (#39) |
| `663d74f` | All / Books / Audio segments (#37) |
