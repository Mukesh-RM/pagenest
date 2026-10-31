# InkQuiet Status

**Current phase:** Setup complete. Phase 0 not started.
**Last updated:** 2026-10-24 (Asia/Calcutta)

## Team roster

| # | Bot | Owns | Responsibility |
|---|---|---|---|
| 1 | Architect | `/src/app`, `/src/data` | Repo structure, interfaces (ReaderEngine, AudioController, VoiceEngine), data model |
| 2 | UI/UX Designer | `/src/ui` | Design tokens, themes, screens and gestures (section 5), component library |
| 3 | Shell and PWA | `/src/sw`, PWA config | Vite, React, manifest, service worker, install flow, safe areas, updates |
| 4 | Library | `/src/features/library`, `/src/workers/import` | Import, OPFS, IndexedDB, metadata, covers, fingerprints, search, collections, backup and restore |
| 5 | Reader | `/src/features/reader`, `/src/engines/pdf`, `/src/engines/epub` | PDF and book formats, pagination, highlights, notes, search, exact resume |
| 6 | Audio | `/src/features/player`, `/src/engines/audio` | Audio controller, Media Session, chapters, sleep timer, background playback, mini and full player |
| 7 | Narration | `/src/features/narration`, `/src/engines/tts`, `/src/engines/emotion` | Piper and Kokoro in workers, chapter render queue, Opus cache, segmenter, emotion tagger, delivery planner, cast voices |
| 8 | Voice Studio | `/src/features/voice-studio` | Recording flow, live consent phrase, My Voice Pack export/import, Voice Helper package format, voice management |
| 9 | QA | `/tests` | Unit tests, Playwright e2e, Lighthouse, offline test, accessibility and contrast checks |
| 10 | DevOps | CI config, deployment | git, GitHub, Cloudflare Pages, CI |
| 11 | Comms | (none) | Sends the email reports |
| 12 | Auditor | (read-only checks) | Licenses of every library, font and model; privacy rules; voice-cloning consent rules; secret scans |

Rule: bots do not edit files owned by another bot; they ask Casey (CEO), who reassigns.

## Phase plan (blueprint section 18; strict order)

A phase is finished only when its gate passes, it is merged, deployed, tagged (`phase-N`) and emailed.

| Phase | Scope | Done when (gate) | State |
|---|---|---|---|
| 0 Foundation | Repo, Vite and React, PWA shell with manifest and service worker, design tokens, themes, navigation, bottom sheets, install prompt | The app installs on Android and iPhone and opens offline | Not started |
| 1 Library and storage | Import (files, share target, drag and drop), OPFS and IndexedDB, metadata and covers, fingerprints, grid and list, search, sort, collections, backup and restore | 500 mixed files import without freezing the screen | Not started |
| 2 Reader | PDF and EPUB first, then MOBI, FB2, DOCX, TXT, CBZ; themes, fonts, scrubber, contents, search, highlights, notes, bookmarks, exact resume | A 50 MB PDF opens in under 1.5 s and the app returns to the same spot after being killed | Not started |
| 3 Audiobooks | Audio controller, Media Session, chapters (M4B, ID3, folders, CUE), speed, skip, sleep timer, bookmarks, mini-player, full player | Two hours play with the screen locked on a real Android phone and a real iPhone, with working lock-screen controls | Not started |
| 4 Read-aloud | Piper in a worker, chapter render queue, Opus cache, sentence highlighting, voice picker, background play | A full chapter reads aloud with the screen off | Not started |
| 5 Expressive narration | Segmenter, emotion tagger, delivery planner, dialogue voice, cast voices, style preview | A listening test shows a clear difference between Natural and Expressive | Not started |
| 6 Voice Studio | Recording flow, live consent phrase, My Voice Pack export/import, Voice Helper package exchange, voice management and delete | A recorded voice trains, imports and reads a chapter | Not started |
| 7 Polish and launch | Accessibility audit, performance tuning, device matrix tests, localization, licenses screen, privacy page, store-free release on free hosting | Every item in section 20 (Definition of Done) is ticked | Not started |

## Blocked / skipped items

- Cloudflare Pages project `pagenest`: intentionally not created yet (setup step only).
- Real-device checks (locked-screen playback etc.) need the owner's hands after Phase 3 and before launch.
