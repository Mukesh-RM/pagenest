# Manual narration smoke (MANUAL-RUN)

Not part of CI or `npm test`. Run after Phase 4 model hosting is approved locally.

## Prerequisites

- Chromium (Playwright): `npx playwright install chromium`
- ~60 MB disk for one English voice

## Download voice (git-ignored)

```bash
mkdir -p .models/narration/en_US-amy-low
curl -L -o .models/narration/en_US-amy-low/en_US-amy-low.onnx \
  'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/low/en_US-amy-low.onnx'
curl -L -o .models/narration/en_US-amy-low/en_US-amy-low.onnx.json \
  'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/low/en_US-amy-low.onnx.json'
```

**License (VERIFY with Auditor):** Piper `en_US-amy-low` — LibriVox-derived / MIT Piper voice policy; see [HF card](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/amy/low).

**SHA-256:** after download, verify with:

```bash
sha256sum .models/narration/en_US-amy-low/*
```

Compare to hashes published on the voice card when available.

## Run

```bash
npm run smoke:narration
```

Builds `tests/manual/narration/dist/smoke-harness.js`, serves model + ORT WASM locally, runs Playwright smoke in Chromium, prints `NARRATION_SMOKE` JSON (RTF, peak, duration).
