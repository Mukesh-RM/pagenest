# ReadEra parity gap list (InkQuiet)

Tracking doc for owner ReadEra polish pass. **Done** items link to merge SHAs when landed.

## Library

| Status | Gap |
|--------|-----|
| Done | **All / Books / Audio segment** (`663d74f`, #37) |
| Done | Format tag on grid/list cards |
| Done | Collection shelf cover collages |
| Done | Book detail: Read aloud (`LibraryScreen` → reader + narration sheet) |
| Done | Book detail: tabs (chapters, marks, info) |
| Done | Pull-to-refresh library list |

## Reader feel

| Status | Gap |
|--------|-----|
| Done | **Tap zones on book content** (`e0ec133`, #30) |
| Done | **Page turn mode in Aa** (`e214e66`, #31) |
| Done | Align, hyphenation, paragraph spacing in Aa |
| Done | Edge brightness / warm filter (left/right edge vertical swipe) |
| Done | Warm EPUB reopen budget in `release-smoke.spec.ts` (8s headless; device target 1.5s) |

## Marks & resume

| Status | Gap |
|--------|-----|
| Done | Selection bar: copy, note shortcut |
| Done | Selection bar: read-aloud from selection |
| Done | Bookmark ticks on scrubber (accent ticks; stores `fraction` on new bookmarks) |
| Done | Release smoke: assert saved read position after reload (live upgrade spec) |
| Done | MiniSearch background index (in-book + library blurb search) |

## Audio & tools (from prior PRs on main)

| Status | Gap |
|--------|-----|
| Done | Drive mode (`DriveModeOverlay`) |
| Done | Expanded sleep timer (`SleepTimerPanel`) |
| Done | Account-free device sync (QR / `.pnsync` file) |
| Done | Offline dictionary + translate on tap (`DictionaryHost`) |

## Read aloud

| Status | Gap |
|--------|-----|
| Done | Device Web Speech default (`753d761`) |
| Done | Read aloud from library detail |
| Done | Footer headphone opens narration |
| Done | PDF read-aloud (visible page text) |

## Live smoke

| Status | Gap |
|--------|-----|
| Done | WebKit foliate engine fix (`109a37b` bootstrap + sandbox strip; `#35`) |
| Done | Pages `_headers` CSP/COOP scoped to HTML only (`b7ec1fc`, `#36`) |
| Done | WebKit upgrade after SW reload (`67f4221` precache + import retry; no console allowlist) |
| Done | Full green `smoke:live` on Pages after `76bb353` deploy (412×915 / 390×844 smoke + ReadEra shots) |
