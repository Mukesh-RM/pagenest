# Voice Studio (Phase 6)

Guided recording of the user’s **own** voice only, with a live random consent phrase verified before any sample is saved. Voices are stored locally (Dexie `voices` + OPFS under `voices/{id}/`). Export produces a **My Voice Pack** zip for offline training; delete removes IndexedDB rows and OPFS files.

## Licences (redistribution)

| Component | Licence | Notes |
|-----------|---------|--------|
| `jszip` | MIT (PageNest uses MIT side of dual licence) | Lazy-loaded on export only |
| WAV encoder | PageNest MIT | Pure TypeScript in `audio/wav-encode.ts` |
| Web Speech API | Browser built-in | Used for live consent verification when available |

## Lazy loading

- Route shell: `LazyVoiceStudioRoot` / `preloadVoiceStudio()`
- Recording: `loadVoiceRecorder()` dynamic import
- Export zip: dynamic `import('jszip')`

## Tests

- Unit: `npm test -- src/features/voice-studio`
- E2E (mock mic): `npm run test:e2e:voice-studio`

## Shared files touched (when wired into the app shell)

- `package.json` — `jszip` dependency and `test:e2e:voice-studio` script only (no app route yet; use the e2e harness or import `@/features/voice-studio` from Settings in a follow-up).
