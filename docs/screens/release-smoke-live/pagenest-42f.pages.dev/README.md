# Live release smoke @ pagenest-42f.pages.dev

360×740 Playwright profiles (`release-smoke-chromium` = Pixel 7, `release-smoke-webkit` = iPhone 14).

Run:

```bash
npm run smoke:live -- https://pagenest-42f.pages.dev/
```

## Deploy **`4bb85d9`** — **all green** @ live (2026-11-02)

Warm first-launch perf (#50): deferred service worker + storage bootstrap. Live smoke waits for idle registration, uses persistent profiles where WebKit OPFS needs them, and avoids WebKit same-URL navigations on SW-controlled reader routes.

| Phase | Chromium | WebKit |
|-------|----------|--------|
| Upgrade | **PASS** | **PASS** |
| Core | **PASS** | **PASS** |
| OPFS blocked | skip (live) | skip (live) |
| Read-aloud (device) | **PASS** | **PASS** |
| Read-aloud (legacy Piper) | **PASS** | **PASS** |
| Voice clone gate | **PASS** | **PASS** |
| ReadEra parity shots | **PASS** | **PASS** |
| Format fixtures (MOBI, FB2, TXT, CBZ, PDF) | **PASS** | **PASS** |
| Backup / restore | **PASS** | **PASS** |
| Share target (manifest + POST) | **PASS** | **PASS** |

Log: `npm run smoke:live -- https://pagenest-42f.pages.dev/` (all phases, 2026-11-02).

### Voice gate screenshots (360px)

| Step | Chromium | WebKit |
|------|----------|--------|
| Voice Studio (no Train on device) | `release-smoke-chromium-voice-gate-01-voice-studio.png` | `release-smoke-webkit-voice-gate-01-voice-studio.png` |
| Narration voices (no My voice) | `…-voice-gate-02-narration-voices.png` | `…-voice-gate-02-narration-voices.png` |

## Prior deploy **`f2a8e72`**

Marks export (#47), read-aloud dock toggle fix, WebKit backup in `testMatch`, refreshed PNGs.

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

### Other smoke paths

**Upgrade:** `release-smoke-{chromium|webkit}-upgrade-01-import.png`, `-02-epub-open.png`, `-03-after-reload.png`

**Core:** `release-smoke-{chromium|webkit}-01-library.png` … `-09-all-formats-after-sw-bump.png`

**Read-aloud:** `release-smoke-{chromium|webkit}-read-aloud-*.png`, `*-read-aloud-legacy-*.png`

## Prior merges on this host

| SHA | Notes |
|-----|--------|
| `4bb85d9` | Warm perf + deferred bootstrap; live smoke hardened (#50) |
| `f2a8e72` | Marks export, live all-green, phase audit (#47) |
| `dfe1b23` | Backup live smoke + full stack on Pages |
| `b4af337` | Document engine + format fixture live shots |
| `be3c58a` | Selection/footer read-aloud (#44) |
| `bfcc583` | ReadEra live shots (#43) |
