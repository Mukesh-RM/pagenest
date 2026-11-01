# Live release smoke — `https://pagenest-42f.pages.dev`

Deploy bundle: `main-n1l1THxk.js` (git `19f2b3922efb28699a962b3b0b7f0965489ccd40`).

Command: `npm run smoke:live -- https://pagenest-42f.pages.dev` (360px Pixel 7 + iPhone 14 profiles).

Run date: 2026-11-01 (UTC).

| Phase | Project | Test | Result |
|-------|---------|------|--------|
| Core | release-smoke-chromium | upgraded profile | **PASS** |
| Core | release-smoke-chromium | fresh import EPUB/PDF/MP3 + reload + SW | **PASS** |
| Core | release-smoke-chromium | OPFS blocked | skip (live) |
| Core | release-smoke-webkit | upgraded profile | **FAIL** — foliate text timeout 240s (reader stuck “Opening…”) |
| Core | release-smoke-webkit | fresh import + reload + SW | **FAIL** — same |
| Core | release-smoke-webkit | OPFS blocked | skip |
| Read-aloud | release-smoke-chromium | device voice play/pause/speed | **PASS** |
| Read-aloud | release-smoke-chromium | legacy Piper pref → device voice | **PASS** |
| Read-aloud | release-smoke-webkit | device voice | **FAIL** — foliate never opened |
| Read-aloud | release-smoke-webkit | legacy Piper pref | **FAIL** — foliate never opened |

Chromium read-aloud + legacy migration screenshots are in this folder (`*-read-aloud-*`). WebKit core captures stop at library/import (`release-smoke-webkit-*.png`).
