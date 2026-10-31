# engines/audio

`types.ts` defines the `AudioController` contract (Architect). This folder implements:

- `createAudioController` — single `HTMLAudioElement`, gapless multi-track handoff, progress saves, sleep timer on the audio clock
- `metadata.worker.ts` — ID3/M4B chapter parsing off the main thread (music-metadata + mp4box)
- CUE parser, folder MP3 builder, Media Session bridge

Change `types.ts` only through the Architect (ask Casey).
