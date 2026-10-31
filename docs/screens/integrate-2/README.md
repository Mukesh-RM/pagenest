# Wired screens at 360 px, integrate-2

Production build of `feature/integrate-2` after merging the UI chain through `feature/ui-library-needs` 062e539, `feature/library-4` e54706c and
`feature/qa-textscale` a12d33f, `feature/ui-qa-fixes` a1cbe54, `feature/ui-audio-bookmarks` 9f9a8ae and `feature/reader-live-pdf` e03ea0c (the design system's Onboarding, Settings, Collections and Stats screens, the Library's Backup/Storage panels and
windowed Library), at a 360 × 740 phone viewport, 2× pixel ratio, taken with touch input. The Library holds the real sample book (Peter Rabbit)
from the real provider. Docs only: nothing in the app reads these files. PNGs are palette-optimised. No horizontal scroll on any screen
listed (document width 360 px); layout shift and axe results are in the QA gate table of the report.

| File | Screen |
| --- | --- |
| `01-onboarding-welcome.png` | Onboarding card 1 |
| `02-onboarding-home-and-sample.png` | Onboarding card 2 with "Open a sample book" |
| `03-onboarding-pick-a-look.png` | Onboarding card 3 |
| `04-library-empty.png` | Library after Skip |
| `05-library-with-sample.png` | Library with the sample book |
| `06-reader-after-sample.png` | The Reader's live reader on the sample book, opened by the sample card (real text, chapter, scrubber) |
| `07-collections.png` | Collections (the design system's screen) with one shelf made |
| `08-settings-top.png`, `09-settings-bottom.png` | Settings, with Backup and restore and Storage on this device |
| `10-settings-custom-theme.png` | Settings with the Custom theme |
| `11-stats.png` | Stats (the design system's screen) |

`../wiring/` holds the earlier set; its Onboarding, Collections and Settings shots are superseded by this folder.

For store-style ordering, captions, and optional shots, see [../../STORE_SCREENSHOTS.md](../../STORE_SCREENSHOTS.md).
