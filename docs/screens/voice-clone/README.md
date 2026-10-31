# Voice clone (My voice) — screenshots & quality

## UI

| File | Description |
|------|-------------|
| [narration-my-voice-picker.png](./narration-my-voice-picker.png) | Reader narration sheet with **My voice** after Voice Studio consent |
| [prepare-download-progress.png](./prepare-download-progress.png) | Optional SpeechT5 + x-vector download during **Prepare voice** (user-initiated) |

## Sample quality (on-device)

**Neural tier (capable devices, after download):** SpeechT5 + HiFi-GAN ONNX (`Xenova/speecht5_tts`, MIT) is driven by a 512-dimensional x-vector from your consented Voice Studio clips (`spkrec-xvect-voxceleb-onnx`, Apache-2.0). Output is 16 kHz mono waveform synthesis — intelligible, natural prosody for narration-length sentences, with timbre aligned to your recordings (not a Piper preset with a light filter).

**Lite tier (fallback):** Devices reporting ≤3 GB RAM, or when neural weights are not downloaded / WASM inference fails, use reference-guided spectral colorization over a local carrier. This keeps weak hardware usable but does **not** match neural cloning quality.

**Privacy:** Models download only after consent verification and an explicit in-app download; all inference runs offline in a Web Worker. No audio leaves the device.
