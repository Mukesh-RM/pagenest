# Locked-screen and background audio (web reality)

This document complements `docs/audio-real-device-checklist.md` and blueprint **section 15**. It states what browsers actually do, and what InkQuiet does in code today (`src/engines/audio`, `src/features/player`).

## Platform limits

| Topic | Web reality | User impact |
| --- | --- | --- |
| **iOS / iPadOS PWA** | Installed PWAs can keep playing with the screen locked, but iOS may pause audio after phone calls, alarms, Siri, or low-memory events. No guarantee like a native app. | Rare stops; position must be saved often. |
| **Android PWA** | Generally reliable background audio with a media notification when installed. OEM battery optimizers can kill the process. | Occasional stops on some brands; install + battery tip helps. |
| **Browser tab (not installed)** | Chrome may throttle timers and deprioritize background tabs; playback is less reliable than installed. | We recommend installing (blueprint 8.4). |
| **Screen lock** | Lock screen controls come from the **Media Session API**, not from our React UI (which is not on screen). | Metadata and actions must stay synced in `media-session.ts`. |
| **Tab backgrounding** | Audio via a single `HTMLAudioElement` continues in many cases; `document.visibilitychange` does not mean playback stopped. | Do not pause on `visibilitychange`; flush progress instead (`progress-service` + controller). |
| **Timer throttling** | `setInterval` / `setTimeout` in the main thread slow down or stop in background tabs. | Sleep timer uses **audio clock** (`timeupdate` on the element), not wall-clock timers (`audio-controller.ts`). |
| **Wake Lock** | `navigator.wakeLock` only keeps the **screen on** while the app is visible; it does not prevent lock-screen audio and is released when the screen locks. | Optional, best-effort in `PlayerProvider`; not required for lock-screen play. |
| **Autoplay** | Browsers block `audio.play()` without a user gesture. | `play()` only from taps/keys; never autoplay on load. |
| **Audio interruptions** | Calls, other apps, Bluetooth disconnect can pause the element or route audio elsewhere. | Listen for `pause`, `stalled`, `error`; save on `pause`; retry `play()` on `stalled` when appropriate (`audio-controller.ts`). |
| **Web Audio routing** | Routing through `AudioContext` can break background playback on some phones (blueprint 8.1). | Default path is the plain `HTMLAudioElement` only; no Web Audio boost in v1. |
| **Bluetooth / headset** | Media Session **seek** and **play/pause** map to headset buttons when the OS exposes them. | Handlers in `createMediaSessionBridge`; skip uses configured seconds. |
| **Reader immersive route** | `/read/:id` hides the mini-player; it does not stop audio. | All state in `AudioController` + Zustand store, not in mini-player components (`docs/ROUTE_CHROME.md`). |

## Mitigations in code

1. **Single element** — `createAudioController` owns one `HTMLAudioElement` for the app lifetime (`PlayerProvider`).
2. **State outside UI** — `usePlayerStore` mirrors the controller; mini-player unmount on immersive routes does not reset playback (`playback-snapshot.ts`, tests in `playback-chrome.test.tsx`).
3. **Progress** — `ProgressService.report` while playing; `save` on pause; `flush` on `pagehide` / `visibilitychange` hidden (`attachProgressLifecycle` in app + controller pause).
4. **Media Session** — title, chapter, artwork, position state, play/pause/seek/chapter actions (`media-session.ts`).
5. **Sleep timer** — counts down using book position and speed on `timeupdate`; gentle volume fade before pause.
6. **No foreground timers for sleep** — avoids background throttling (blueprint 8.3).
7. **Install + persistence** — Shell/PWA prompts (outside Audio); Audio exposes `useIsPlaying()` so updates never reload during playback.

## What we cannot promise

- Uninterrupted play through every OS update, call, or OEM kill policy.
- CarPlay, Android Auto, or lock-screen widgets without a native wrapper.
- Gapless perfection across all formats on all browsers.

Validate on real hardware using `docs/audio-real-device-checklist.md` each release.
