# Launch checklist — real devices

Run against a **production or release-candidate build** installed to the home screen (not a background browser tab). Record **device model, OS version, browser, and git SHA** for every row.

Related: [FEEDBACK.md](./FEEDBACK.md) (friend sessions), [audio-real-device-checklist.md](./audio-real-device-checklist.md) (deep audio QA), [TESTING.md](./TESTING.md) (automated gates).

---

## iPhone / iPad (Safari → Add to Home Screen)

### Install and shell

- [ ] Add to Home Screen: icon, name, and splash look correct (matches [manifest](../public/manifest.webmanifest)).
- [ ] Launch from icon opens standalone (no Safari URL bar).
- [ ] Onboarding can be completed or skipped; library reachable either way.
- [ ] Tab bar / navigation: Library, Reader, Player, Settings (as shipped) — no dead routes.
- [ ] Safe areas: notch and home indicator do not clip primary actions at 360–430 pt width.

### Offline and updates

- [ ] After one online load, **airplane mode**: app opens, library and previously opened books still available.
- [ ] Service-worker update: new deploy shows “update available” (or equivalent) without losing library data.

### Import and library edge cases

- [ ] Import via share sheet: EPUB and PDF from Files.
- [ ] Odd filenames: spaces, brackets, unicode, long names — book imports and remains openable.
- [ ] Duplicate import: sensible behavior (no corrupt duplicates).
- [ ] Very long title / missing cover: list layout readable at 200% text size (if supported).

### Reading

- [ ] Sample book and imported reflow book: scroll/page turn, TOC, progress persists after kill and relaunch.
- [ ] PDF (if live in build): pinch zoom, page change, resume position.
- [ ] Reader settings sheet: theme, font size — changes apply without trapping focus.

### Narration / TTS (if enabled)

- [ ] Read-aloud starts from visible text; stops on leave reader or explicit stop.
- [ ] Background: behavior documented (iOS may pause TTS when locked — note actual result).
- [ ] No unexpected network calls during narration (DevTools or proxy if testing over Wi‑Fi).

### Audiobook / player

- [ ] Play from library; **lock screen** Now Playing and controls work ≥ 2 minutes.
- [ ] Incoming call / Siri: playback pauses and resumes at same position when possible.
- [ ] Bluetooth earbuds: play/pause/skip.
- [ ] Sleep timer / speed change (if present) behave as labeled.

### Backup and privacy (if UI present)

- [ ] Export backup produces a file; re-import on same device (or second device) restores titles/progress.
- [ ] Storage panel reflects local-only data; no login prompt.

---

## Android (Chrome → Install PWA)

### Install and shell

- [ ] Install prompt or menu install works; launcher icon correct.
- [ ] Standalone display; back gesture behaves (sheets dismiss before exit).
- [ ] Share target: share EPUB/PDF from Files/Downloads into PageNest (if manifest share_target enabled).

### Offline and storage

- [ ] Airplane mode after first load: library + open books work.
- [ ] Low-storage warning or graceful failure if OPFS quota exceeded (note device).

### Import edge cases

- [ ] Same odd-filename matrix as iOS.
- [ ] Large file (representative size for your testers): import completes without UI freeze > 5 s.

### Reading, narration, audio

- [ ] Same reading checks as iOS for formats you ship.
- [ ] Lock screen: Media Session metadata, play/pause, skip, scrubber (see audio checklist).
- [ ] Background 30+ minutes without OEM “battery saver” killing playback (note manufacturer if fail).

---

## Cross-platform sanity

- [ ] **No login, ads, or analytics** requests in network panel during core flows.
- [ ] **MIT license** and privacy posture visible in README / Settings if you surface “About”.
- [ ] **200% text** and **Reduce motion**: readable layout, no essential motion-only cues ([TESTING.md](./TESTING.md) excellence themes).
- [ ] Console: zero errors during sample-book read + one import + 5 min audio (where applicable).

---

## Store-style assets (before listing or press)

- [ ] Screenshot set captured per [STORE_SCREENSHOTS.md](./STORE_SCREENSHOTS.md).
- [ ] Short and long description aligned with [manifest](../public/manifest.webmanifest) and README.
- [ ] Name check reviewed: [NAME_CHECK.md](./NAME_CHECK.md).

---

## Sign-off

| Platform | Tester | SHA | Date | Go / no-go |
| --- | --- | --- | --- | --- |
| iPhone | | | | |
| Android | | | | |
| iPad (optional) | | | | |

**No-go criteria:** data loss on relaunch, import silently fails, offline broken after install, or lock-screen audio controls missing on a platform you claim to support.
