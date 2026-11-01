# Piper voice hosting (read-aloud)

Read-aloud downloads **five audit-OK Piper voices** from **this app origin**, not Hugging Face at runtime. After the first successful download, weights live in **OPFS** (`voices/piper/{voiceId}.onnx`) and work **fully offline**.

## Why not a single file on Cloudflare Pages?

Cloudflare Pages serves static assets with a **25 MB per-file limit**. Every offered ONNX is larger:

| Voice | Approx. size | Parts @ 24 MB |
|-------|--------------|---------------|
| `en_US-kristin-medium` | 61 MB | 3 |
| `en_US-john-medium` | 61 MB | 3 |
| `en_US-ljspeech-medium` | 61 MB | 3 |
| `en_GB-cori-high` | 109 MB | 5 |
| `en_US-libritts-high` | 130 MB | 6 |

The app therefore fetches **`{voiceId}.onnx.part00`, `.part01`, …** from `/models/piper/{revision}/{hfPath}/`, verifies **SHA-256** (see `public/models/piper/manifest.json`), and caches the merged file in OPFS.

## Deploying model bytes

1. On a maintainer machine (network allowed), run:

   ```bash
   node scripts/sync-piper-models.mjs --out public/models/piper
   ```

   This pulls the pinned Hugging Face revision once, splits ONNX files, and writes configs + parts under `public/models/piper/{revision}/…`.

2. Deploy the site (Cloudflare Pages). Parts are each ≤ 24 MB so they pass the Pages limit.

3. **Optional R2:** For a separate models bucket, upload the same tree and serve it from the same paths via a **Pages `_routes` + R2 binding** or a dedicated subdomain. The runtime only needs same-origin URLs under `/models/piper/`.

Do **not** commit multi-megabyte ONNX parts to git; CI does not run `sync-piper-models.mjs`. Production must run the sync step before deploy (or bind R2).

## Runtime URLs

- Manifest (small, in repo): `/models/piper/manifest.json`
- Config: `/models/piper/{revision}/{hfPath}/{voiceId}.onnx.json`
- Weights (chunked): `/models/piper/{revision}/{hfPath}/{voiceId}.onnx.partNN`

Code: `src/engines/tts/piper/voices.ts`, `voice-download.ts`.

## CSP

`connect-src` stays **`'self'`** only. Voice downloads use same-origin `fetch`; Hugging Face is used only by the maintainer sync script (allowlisted in `scripts/audit-allowlist.json` for scripts, not the app bundle).
