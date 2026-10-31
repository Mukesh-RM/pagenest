# Store-style screenshot list

Marketing and install surfaces (GitHub README, Cloudflare preview, future App Store / Play assets, PWA install help). All paths relative to repo root. **Docs only** — the app does not load these files at runtime.

Capture from a **production build** at **2×** density unless noted. Prefer **430×932** (iPhone 14 Pro Max logical) and **360×800** (common Android) in addition to the wired **360×740** set.

---

## Required set (8–10 frames)

Order matches typical store carousel: hook → library → read → listen → organize → settings/trust.

| # | Asset filename (suggested) | Screen | Source / notes |
| --- | --- | --- | --- |
| 1 | `01-onboarding-welcome.png` | Welcome / value prop | `docs/screens/integrate-2/01-onboarding-welcome.png` |
| 2 | `02-library-with-books.png` | Library with sample + import affordance | `docs/screens/integrate-2/05-library-with-sample.png` |
| 3 | `03-reader-reflow.png` | Reader on sample EPUB (live text) | `docs/screens/integrate-2/06-reader-after-sample.png` |
| 4 | `04-collections.png` | Collections / shelves | `docs/screens/integrate-2/07-collections.png` |
| 5 | `05-player-full.png` | Full audiobook player | `docs/screens/audio/player-430-sepia.png` or theme variants under `docs/screens/audio/` |
| 6 | `06-mini-player.png` | Mini player over library | `docs/screens/audio/mini-player-430-light.png` |
| 7 | `08-settings-trust.png` | Settings: backup, storage, themes (top) | `docs/screens/integrate-2/08-settings-top.png` |
| 8 | `09-settings-bottom.png` | Settings continued (accessibility, audio) | `docs/screens/integrate-2/09-settings-bottom.png` |
| 9 | `10-stats.png` | Reading stats | `docs/screens/integrate-2/11-stats.png` |
| 10 | `11-install-help.png` | Install / Add to Home Screen help | `docs/screens/wiring/19-install-help-sheet.png` |

**Caption themes (short, for store copy):**

1. Free reader and player — no account.  
2. Your library stays on this device.  
3. EPUB, PDF, and more with themes you control.  
4. Collections for series and moods.  
5. Audiobooks with lock-screen controls.  
6. Keep listening while you browse.  
7. Backup and storage you can see.  
8. Text size, themes, and motion settings.  
9. Streaks and time read — private stats.  
10. Install in one tap from the browser.

---

## Optional depth (differentiation)

| Asset | Screen | Path |
| --- | --- | --- |
| Custom theme | Settings custom palette | `docs/screens/integrate-2/10-settings-custom-theme.png` |
| Onboarding sample CTA | “Open sample book” | `docs/screens/integrate-2/02-onboarding-home-and-sample.png` |
| Reader settings sheet | Typography / theme in reader | `docs/screens/wiring/16-reader-settings-sheet.png` |
| Player themes | Black / dark / sepia at 360 width | `docs/screens/audio/player-360-*.png`, `mini-player-360-*.png` |
| Empty library | First-run import story | `docs/screens/integrate-2/04-library-empty.png` |

---

## Regeneration

Wired PNGs and viewport rules: [docs/screens/integrate-2/README.md](./screens/integrate-2/README.md), [docs/screens/wiring/README.md](./screens/wiring/README.md). After UI changes, re-run the project’s screenshot / QA pipeline documented in [TESTING.md](./TESTING.md) and replace files here rather than editing PNGs by hand.

---

## Checklist before publish

- [ ] No personal filenames, real phone numbers, or copyrighted cover art without rights.
- [ ] Status bar time/battery neutral or consistent across shots.
- [ ] Same app version and theme family across the carousel.
- [ ] Manifest `name` / `description` match screenshot captions ([../public/manifest.webmanifest](../public/manifest.webmanifest)).
