# Audiobook real-device checklist (Phase 3)

Run on a **production build** installed to the home screen (not a background browser tab). Use a public-domain audiobook you imported (MP3 folder or M4B).

## Android (installed PWA)

- [ ] Play starts from a tap; no autoplay on load.
- [ ] Lock the screen: audio continues for at least 30 minutes.
- [ ] Notification shows title, cover, play/pause, skip, and scrubber (Media Session).
- [ ] Skip back/forward match Settings (10/15/30/60 s).
- [ ] Speed 0.5x–3x keeps pitch natural; time-left matches chosen speed.
- [ ] Sleep timer (minutes and end-of-chapter) pauses with a gentle fade.
- [ ] Kill the app from recents; reopen within 2 s resumes the same second.
- [ ] Bluetooth headset play/pause/skip work.
- [ ] No unexpected pause when switching apps (note OEM battery killers).

## iPhone / iPad (Add to Home Screen)

- [ ] Lock screen: Now Playing shows metadata and responds to controls.
- [ ] Incoming call or alarm: playback stops; resume after returns to the same position.
- [ ] Background for 30+ minutes without silent failure.
- [ ] Scrubber on lock screen seeks correctly.

## Desktop (Chrome / Edge)

- [ ] Tab in background: playback continues.
- [ ] Media keys (if present) control play/pause.
- [ ] Keyboard shortcuts (space, J/K/L, arrows) do not fire in text fields.

## Accessibility

- [ ] Dark and Black themes: AA contrast on player controls.
- [ ] 200% text size: layout intact, targets ≥ 44 px.
- [ ] Reduce motion: no decorative motion on the full player sheet.

## Regression

- [ ] Console: zero errors during a full chapter.
- [ ] Airplane mode: playback works (local files only).

Record device model, OS version, browser, and build SHA with each run.
