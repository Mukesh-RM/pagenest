import { encodeWavMono } from '../audio/wav-encode';
import type { RecordedClip } from '../audio/recorder';
import type { VoiceStudioTestRecorder } from '../VoiceStudioApp';

/** Headless-friendly recorder for Playwright (no AudioContext). */
export function createE2eTestRecorder(): VoiceStudioTestRecorder {
  let levelFn: ((level: number) => void) | undefined;
  const clip: RecordedClip = {
    blob: encodeWavMono(new Float32Array(1600).fill(0.02), 16_000),
    durationSec: 0.1,
    sampleRate: 16_000,
  };
  return {
    setLevelListener(fn) {
      levelFn = fn;
    },
    async attach() {
      levelFn?.(0.2);
    },
    async stop() {
      levelFn?.(0);
      return clip;
    },
    async dispose() {
      levelFn?.(0);
    },
  };
}
