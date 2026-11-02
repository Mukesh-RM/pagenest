# Live release smoke @ pagenest-42f.pages.dev

360×740 Playwright profiles (`release-smoke-chromium` = Pixel 7, `release-smoke-webkit` = iPhone 14).

Run:

```bash
npm run smoke:live -- https://pagenest-42f.pages.dev/
```

## Deploy **`dfe1b23`** — **all green** @ live re-run (2026-11-02)

Includes backup/formats phases through **`dfe1b23`**. Read-aloud live smoke needs **`openReadAloudControls`** dock-toggle fix (this PR) after footer headphone shipped in **`be3c58a`**.

| Phase | Chromium | WebKit |
|-------|----------|--------|
| Upgrade | **PASS** | **PASS** |
| Core | **PASS** | **PASS** |
| OPFS blocked | skip (live) | skip (live) |
| Read-aloud (device) | **PASS** | **PASS** |
| Read-aloud (legacy Piper) | **PASS** | **PASS** |
| ReadEra parity shots | **PASS** | **PASS** |
| Format fixtures (MOBI, FB2, TXT, CBZ, PDF) | **PASS** | **PASS** |
| Backup / restore | **PASS** | **PASS** |

## Prior deploy notes

### Format fixture screenshots (360px)

| Format | Chromium | WebKit |
|--------|----------|--------|
| MOBI | `release-smoke-chromium-formats-mobi-open.png` | `release-smoke-webkit-formats-mobi-open.png` |
| FB2 | `…-formats-fb2-open.png` | `…-formats-fb2-open.png` |
| TXT | `…-formats-txt-open.png` | `…-formats-txt-open.png` |
| CBZ | `…-formats-cbz-open.png` | `…-formats-cbz-open.png` |
| PDF | `…-formats-pdf-open.png` | `…-formats-pdf-open.png` |

### Backup / restore screenshots (360px)

| Step | Chromium | WebKit |
|------|----------|--------|
| Settings panel | `release-smoke-chromium-backup-01-settings.png` | `release-smoke-webkit-backup-01-settings.png` |
| Library after restore | `…-backup-02-restored.png` | `…-backup-02-restored.png` |

Paths are under this folder (`docs/screens/release-smoke-live/pagenest-42f.pages.dev/`).

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
| `dfe1b23` | Backup live smoke + full stack on Pages |
| `b4af337` | Document engine + format fixture live shots |
| `be3c58a` | Selection/footer read-aloud (#44) |
| `bfcc583` | ReadEra live shots (#43) |
