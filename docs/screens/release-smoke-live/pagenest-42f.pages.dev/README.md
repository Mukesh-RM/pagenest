# Live release smoke @ pagenest-42f.pages.dev

360×740 Playwright profiles (`release-smoke-chromium` = Pixel 7, `release-smoke-webkit` = iPhone 14).

Run:

```bash
npm run smoke:live -- https://pagenest-42f.pages.dev/
```

## Deploy **`76bb353`** (`a4c7e87` ReadEra + `67f4221` SW) — **all green** (2026-11-02)

| Phase | Chromium | WebKit |
|-------|----------|--------|
| Upgrade | **PASS** | **PASS** |
| Core | **PASS** | **PASS** |
| OPFS blocked | skip (live) | skip (live) |
| Read-aloud (device) | **PASS** | **PASS** |
| Read-aloud (legacy Piper) | **PASS** | **PASS** |
| ReadEra parity shots | **PASS** | **PASS** |

### ReadEra UI screenshots (360px)

| Feature | Chromium | WebKit |
|---------|----------|--------|
| Format chips on cards | `release-smoke-chromium-readera-01-format-chips.png` | `release-smoke-webkit-readera-01-format-chips.png` |
| Detail **Read aloud** | `…-readera-02-detail-read-aloud.png` | `…-readera-02-detail-read-aloud.png` |
| Selection **Copy / Note** | `…-readera-03-selection-copy-note.png` | `…-readera-03-selection-copy-note.png` |
| Collection **cover collage** | `…-readera-04-collection-collage.png` | `…-readera-04-collection-collage.png` |

Paths are under this folder (`docs/screens/release-smoke-live/pagenest-42f.pages.dev/`).

### Other smoke paths

**Upgrade:** `release-smoke-{chromium|webkit}-upgrade-01-import.png`, `-02-epub-open.png`, `-03-after-reload.png`

**Core:** `release-smoke-{chromium|webkit}-01-library.png` … `-09-all-formats-after-sw-bump.png`

**Read-aloud:** `release-smoke-{chromium|webkit}-read-aloud-*.png`, `*-read-aloud-legacy-*.png`

## Prior merges on this host

| SHA | Notes |
|-----|--------|
| `76bb353` | Live smoke table (docs) |
| `a4c7e87` | ReadEra parity batch (#42) |
| `67f4221` | SW precache + import retry (#41) |
| `663d74f` | All / Books / Audio segments (#37) |
