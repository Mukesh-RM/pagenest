import * as ort from 'onnxruntime-web';
import { englishTextToPhonemeIds } from '@/engines/tts/g2p/english-g2p';
import { parseCmudict } from '@/engines/tts/g2p/cmu-dict';
import { runPiperInference } from '@/engines/tts/piper/piper-inference';
import { parsePiperVoiceConfig } from '@/engines/tts/piper/piper-voice-config';

export interface SmokeResult {
  readonly durationSec: number;
  readonly inferSec: number;
  readonly rtf: number;
  readonly peak: number;
  readonly finite: boolean;
}

export async function runNarrationSmoke(options: {
  readonly modelUrl: string;
  readonly configUrl: string;
  readonly dictText: string;
  readonly wasmBaseUrl: string;
}): Promise<SmokeResult> {
  ort.env.wasm.wasmPaths = options.wasmBaseUrl;
  ort.env.wasm.numThreads = 1;

  const [modelBuf, configText] = await Promise.all([
    fetch(options.modelUrl).then((r) => r.arrayBuffer()),
    fetch(options.configUrl).then((r) => r.text()),
  ]);
  const config = parsePiperVoiceConfig(configText);
  const dict = parseCmudict(options.dictText);

  const session = await ort.InferenceSession.create(modelBuf, { executionProviders: ['wasm'] });
  const wrapped = {
    run: async (feeds: Record<string, { dims: readonly number[]; data: ArrayBufferView }>, fetches: string[]) => {
      const ortFeeds: Record<string, ort.Tensor> = {};
      for (const [key, tensor] of Object.entries(feeds)) {
        const type = tensor.data instanceof BigInt64Array ? 'int64' : 'float32';
        ortFeeds[key] = new ort.Tensor(type, tensor.data, [...tensor.dims]);
      }
      const out = await session.run(ortFeeds, fetches);
      const mapped: Record<string, { dims: number[]; data: Float32Array }> = {};
      for (const [k, v] of Object.entries(out)) {
        mapped[k] = { dims: [...v.dims], data: v.data as Float32Array };
      }
      return mapped;
    },
  };

  const sentences = ['Hello from PageNest.', 'This is a manual smoke test.'];
  const t0 = performance.now();
  let totalAudio = 0;
  let peak = 0;

  for (const sentence of sentences) {
    const g2p = englishTextToPhonemeIds(sentence, { dict, voiceConfig: config });
    const result = await runPiperInference(wrapped, config, { phonemeIds: g2p.phonemeIds });
    totalAudio += result.durationSec;
    for (const s of result.samples) {
      peak = Math.max(peak, Math.abs(s));
    }
  }

  const inferSec = (performance.now() - t0) / 1000;
  const rtf = totalAudio > 0 ? inferSec / totalAudio : Infinity;
  return {
    durationSec: totalAudio,
    inferSec,
    rtf,
    peak,
    finite: Number.isFinite(rtf) && peak > 0.001,
  };
}

declare global {
  interface Window {
    runNarrationSmoke: typeof runNarrationSmoke;
  }
}

if (typeof window !== 'undefined') {
  window.runNarrationSmoke = runNarrationSmoke;
}
