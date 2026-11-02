# ReadEra parity gap list (InkQuiet)

Tracking doc for owner ReadEra polish pass. **Done** items link to merge SHAs when landed.

## Library

| Status | Gap |
|--------|-----|
| Done | **All / Books / Audio segment** (`663d74f`, #37) |
| Done | Format tag on grid/list cards |
| Done | Collection shelf cover collages |
| Done | Book detail: Read aloud (`LibraryScreen` → reader + narration sheet) |
| Open | Book detail: tabs (chapters, marks, info) |
| Open | Pull-to-refresh folder list |

## Reader feel

| Status | Gap |
|--------|-----|
| Done | **Tap zones on book content** (`e0ec133`, #30) |
| Done | **Page turn mode in Aa** (`e214e66`, #31) |
| Open | Align, hyphenation, paragraph spacing in Aa |
| Open | Edge brightness / warm filter |
| Open | Open &lt;1.5 s gate on imported EPUB in release smoke |

## Marks & resume

| Status | Gap |
|--------|-----|
| Done | Selection bar: copy, note shortcut |
| Done | Selection bar: read-aloud from selection |
| Open | Bookmark ticks on scrubber |
| Done | Release smoke: assert saved read position after reload (live upgrade spec) |
| Open | MiniSearch background index (blueprint §7) |

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
| Open | Full green `smoke:live` on Pages after `67f4221` deploy (360px screenshots) |
