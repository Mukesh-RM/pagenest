# ReadEra parity gap list (InkQuiet)

Tracking doc for owner ReadEra polish pass. **Done** items link to merge SHAs when landed.

## Library

| Status | Gap |
|--------|-----|
| Open | All / Books / Audio segment (query exists, UI not wired) |
| Open | Format tag on grid/list cards |
| Open | Collection shelf cover collages |
| Open | Book detail: Read aloud, tabs (chapters, marks, info) |
| Open | Pull-to-refresh folder list |

## Reader feel

| Status | Gap |
|--------|-----|
| In PR | **Tap zones on book content** (`doc.onTap` → turn / chrome) |
| Open | Page turn mode in Aa (slide / scroll / none) |
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
| Open | WebKit foliate wait (PR #27) |
| Open | Re-run full `smoke:live` after each parity PR with 360px screenshots |
