# Release screenshots (integrate-2 core launch)

360×740 viewport, 2× device pixel ratio where captured from the production build via `tests/e2e/release-screens.spec.ts`.

| File | Screen |
| --- | --- |
| `library-360-light.png`, `library-360-dark.png` | Library tab |
| `reader-narration-360-light.png`, `reader-narration-360-dark.png` | Reader on sample EPUB with read-aloud controls |
| `player-360-light.png`, `player-360-dark.png` | Full audiobook player (seed title) |
| `settings-360-light.png`, `settings-360-dark.png` | Settings scrolled to Voices (Voice Studio wired) |
| `narration-controls-*.png` | Narration control strip (from narration e2e harness) |
| `voice-studio-*.png` | Voice Studio steps (from voice-studio e2e harness) |

Regenerate after UI changes:

```bash
npm run build
cd tests && npx playwright test release-screens --project=chromium-mobile
```
