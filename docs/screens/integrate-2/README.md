# Wired screens at 360 px, integrate-2

Production build of `feature/integrate-2` (the design system's Onboarding and Settings screens, the
Library's Collections screen and Backup/Storage panels), at a 360 × 740 phone viewport, 2× pixel ratio,
taken with touch input. The Library holds the real sample book (Peter Rabbit) from the real provider.
Docs only: nothing in the app reads these files. PNGs are palette-optimised. The same run checked, on
every screen listed: no horizontal scroll, layout shift (CLS) 0, and no axe violations (WCAG 2 A and AA).

| File | Screen |
| --- | --- |
| `01-onboarding-welcome.png` | Onboarding card 1 |
| `02-onboarding-home-and-sample.png` | Onboarding card 2 with "Open a sample book" |
| `03-onboarding-pick-a-look.png` | Onboarding card 3 |
| `04-library-empty.png` | Library after Skip |
| `05-library-with-sample.png` | Library with the sample book |
| `06-reader-after-sample.png` | Reader opened by the sample card |
| `07-collections.png` | Collections (the Library's screen) |
| `08-settings-top.png`, `09-settings-bottom.png` | Settings, with Backup and restore and Storage on this device |
| `10-settings-custom-theme.png` | Settings with the Custom theme |

`../wiring/` holds the earlier set; its Onboarding, Collections and Settings shots are superseded by this folder.
