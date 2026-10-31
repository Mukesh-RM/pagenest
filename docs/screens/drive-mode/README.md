# Drive mode and sleep timer (feature/drive-mode)

Screenshots and notes from Vitest + Playwright runs on branch `feature/drive-mode`.

## Sleep timer (audiobooks + read-aloud)

- Presets: **5, 10, 15, 30, 45, 60** minutes, **end of chapter**, and **custom** minutes (1–480).
- Gentle fade-out before pause (audio controller).
- **Shake to extend** adds 5 minutes while a timer runs (when `devicemotion` is available).
- Last choice is stored in IndexedDB (`lastSleepTimerSpec`) and offered as **Start again** in the sheet.

## Drive mode

- **Drive mode** chip on the audiobook player; **Drive mode** button on read-aloud controls.
- Full-screen, high-contrast layout: 96px+ touch targets, book title, time left, play/pause, ±30s, prev/next chapter, speed, exit.
- Screen wake lock while drive mode is open; Media Session stays wired through the shared audio controller.
- Lazy-loaded chunk (not part of first-load JS).

## Evidence

| File | Description |
|------|-------------|
| `player-drive-button-light.png` | Player with Drive mode chip |
| `drive-mode-light.png` | Full-screen drive mode |
| `sleep-10min-light.png` | Sleep timer with 10 min preset |
| `drive-mode-landscape-200pct.png` | Drive mode, landscape, 200% text |

After CI, append **commit SHA** and test command results below.

```text
SHA: (filled after push)
Tests: npm test && npm run test:e2e
```
