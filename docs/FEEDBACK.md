# Friend feedback — form and testing script

Use this with **one build URL** (production PWA or a preview) and **one device** each tester already owns. Everything stays free; no account required.

**Build under test:** ____________________  
**Date:** ____________________  
**Tester (first name only):** ____________________

---

## Part A — Five-question feedback form

Ask after the session (voice, text, or printed). Keep answers short.

1. **First impression (30 seconds)**  
   After opening the app from your home screen, what did you think it was for? Was anything confusing on the first screen?

2. **Install and offline**  
   Did “Add to Home Screen” / Install feel obvious? After turning on airplane mode, could you still open the app and reach your library (or the sample book)?

3. **Reading or listening**  
   Pick one: open the **sample book** *or* import **one file you brought**. Was it easy to start, adjust text/theme, and find your way back to the library?

4. **Trust**  
   Did anything make you worry the app was uploading your files, voice, or reading history? What would make privacy clearer?

5. **Would you keep it?**  
   On a scale of 1–5, how likely are you to keep the PWA on your phone for real books? What one thing would most improve that score?

**Optional:** Device model, OS version, browser (Safari/Chrome).

---

## Part B — Short testing script (facilitator)

**Time:** about 25–35 minutes per person  
**Rules for the tester:** Think aloud. There are no wrong answers. Skip steps that fail and note what happened.

### Before they arrive

- [ ] Confirm the build URL loads and the service worker is active (second visit should work offline).
- [ ] Prepare one “weird” test file on your phone to AirDrop/share if they have no book: e.g. `My Book (2024) — draft [v2].epub` or a PDF with spaces and unicode in the name.
- [ ] Have a **public-domain audiobook** (MP3 or M4B) ready to share into the app if audio is in scope for this build.

### 1. Install as a real app (5 min)

**iPhone (Safari):** Open the URL → Share → **Add to Home Screen** → launch from the icon.  
**Android (Chrome):** Open the URL → menu or banner → **Install** → launch from launcher.

- Note: Did they need help? Did the icon/name match “PageNest”?

### 2. Onboarding and sample (5 min)

- [ ] Complete or skip onboarding as they prefer.
- [ ] Open the **sample book** from the library; turn a few pages or scroll; open reader settings once.
- [ ] Leave the reader and return — did position stick?

### 3. Import stress (5 min)

- [ ] Share or pick the oddly named file from Files/Downloads.
- [ ] Confirm it appears in the library with a sensible title/cover (or acceptable fallback).

### 4. Offline check (3 min)

- [ ] Enable airplane mode.
- [ ] Cold-start the PWA from the home screen; open library and the same book again.

### 5. Audio (5 min, if enabled in build)

- [ ] Import or use an audiobook; press play; lock the screen 1–2 minutes.
- [ ] Confirm playback continues and lock-screen controls appear (platform-dependent).

See [audio-real-device-checklist.md](./audio-real-device-checklist.md) for deeper audio QA.

### 6. Narration / read-aloud (5 min, if enabled)

- [ ] From an EPUB or reflow book, start read-aloud or narration for one paragraph.
- [ ] Change voice or speed if settings exist; stop cleanly.

### 7. Wrap (2 min)

- [ ] Ask the five questions in Part A.
- [ ] Record blockers verbatim (“I tapped X and nothing happened”).

### Facilitator log

| Step | Pass / partial / fail | Notes |
| --- | --- | --- |
| Install PWA | | |
| Sample book | | |
| Odd filename import | | |
| Offline | | |
| Audiobook + lock screen | | |
| Narration | | |

Send logs to the team chat or issue tracker; tag with build SHA.
