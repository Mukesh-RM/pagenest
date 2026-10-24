# Manual narration smoke (MANUAL-RUN)

Not part of CI or `npm test`. Run after Phase 4 model hosting is approved locally.

## Prerequisites

- Chromium (Playwright): `npx playwright install chromium`
- ~64 MB disk for the default English voice (`en_US-ljspeech-medium`)

## Download voice (git-ignored)

```bash
VOICE=en_US-ljspeech-medium
mkdir -p ".models/narration/${VOICE}"
curl -L -o ".models/narration/${VOICE}/${VOICE}.onnx" \
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ljspeech/medium/${VOICE}.onnx"
curl -L -o ".models/narration/${VOICE}/${VOICE}.onnx.json" \
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ljspeech/medium/${VOICE}.onnx.json"
```

**License:** LJ Speech dataset — public domain ([keithito.com](https://keithito.com/LJ-Speech-Dataset/)); voice vetted **OK** in `docs/MODEL_VETTING.md` (Auditor registry).

**Expected SHA-256 (`.onnx` LFS oid on Hugging Face):** `6f52a751e2349abe7a76735eb09dc1875298c77ea2342ffd2fef79ff81b87f22`  
**Size:** 63 531 379 bytes (~60.6 MB).

```bash
sha256sum ".models/narration/${VOICE}/${VOICE}.onnx"
```

**Do not use** `en_US-amy-low`, `en_US-lessac*`, `en_US-libritts_r*`, or other non-vetted Piper ids — see `src/engines/tts/piper/approved-voices.ts`.

## Run

```bash
npm run smoke:narration
```

Builds `tests/manual/narration/dist/smoke-harness.js`, serves model + ORT WASM locally, runs Playwright smoke in Chromium, prints `NARRATION_SMOKE` JSON (RTF, peak, duration).
