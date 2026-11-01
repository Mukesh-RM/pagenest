# ReadEra parity gap list (InkQuiet)

Tracking doc for owner ReadEra polish pass. **Done** items link to merge SHAs when landed.

## Library

| Status | Gap |
|--------|-----|
| In PR | **All / Books / Audio segment** (`LibraryQuery.segment` wired to toolbar chips) |
| Open | Format tag on grid/list cards |
| Open | Collection shelf cover collages |
| Open | Book detail: Read aloud, tabs (chapters, marks, info) |
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
| Open | Selection bar: copy, note shortcut, read-aloud from selection |
| Open | Bookmark ticks on scrubber |
| Open | Release smoke: assert saved read position after reload |
| Open | MiniSearch background index (blueprint §7) |

## Read aloud

| Status | Gap |
|--------|-----|
| Done | Device Web Speech default (`753d761`) |
| Open | Read aloud from library detail |
| Open | Footer headphone opens narration |
| Open | PDF read-aloud |

## Live smoke

| Status | Gap |
|--------|-----|
| Done | WebKit foliate engine fix (`109a37b` bootstrap + sandbox strip; `#35`) |
| Done | Pages `_headers` CSP/COOP scoped to HTML only (`b7ec1fc`, `#36`) |
| Open | Full green `smoke:live` on Pages after `b7ec1fc` deploy (360px screenshots) |
