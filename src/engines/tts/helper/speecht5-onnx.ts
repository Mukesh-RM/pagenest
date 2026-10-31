import type { Tensor } from 'onnxruntime-web';
import type { SpeechT5Tokenizer } from './speecht5-tokenizer';

const NUM_MEL_BINS = 80;
const HIDDEN = 768;
const HEADS = 12;
const HEAD_DIM = HIDDEN / HEADS;
const DECODER_LAYERS = 6;
const REDUCTION_FACTOR = 2;
const THRESHOLD = 0.5;
const MINLEN_RATIO = 0;
const MAXLEN_RATIO = 20;

type OrtModule = typeof import('onnxruntime-web/wasm');

export interface SpeechT5Stack {
  synthesize(text: string, speakerEmbedding: Float32Array): Promise<Float32Array>;
  dispose(): Promise<void>;
}

function wasmOrigin(): string {
  try {
    return `${self.location.origin}/ort/`;
  } catch {
    return '/ort/';
  }
}

function fakePastKeyValues(ort: OrtModule, batch = 1): Record<string, Tensor> {
  const out: Record<string, Tensor> = {};
  const shape: [number, number, number, number] = [batch, HEADS, 0, HEAD_DIM];
  for (let i = 0; i < DECODER_LAYERS; i += 1) {
    const z = new Float32Array(0);
    out[`past_key_values.${i}.decoder.key`] = new ort.Tensor('float32', z, shape);
    out[`past_key_values.${i}.decoder.value`] = new ort.Tensor('float32', z, shape);
    out[`past_key_values.${i}.encoder.key`] = new ort.Tensor('float32', z, shape);
    out[`past_key_values.${i}.encoder.value`] = new ort.Tensor('float32', z, shape);
  }
  return out;
}

function realPastKeyValues(
  _ort: OrtModule,
  decoderOutputs: Record<string, Tensor | undefined>,
  crossAttentionPkv: Record<string, Tensor>,
): Record<string, Tensor> {
  const out: Record<string, Tensor> = {};
  for (let i = 0; i < DECODER_LAYERS; i += 1) {
    out[`past_key_values.${i}.decoder.key`] = decoderOutputs[`present.${i}.decoder.key`]!;
    out[`past_key_values.${i}.decoder.value`] = decoderOutputs[`present.${i}.decoder.value`]!;
    out[`past_key_values.${i}.encoder.key`] = crossAttentionPkv[`present.${i}.encoder.key`]!;
    out[`past_key_values.${i}.encoder.value`] = crossAttentionPkv[`present.${i}.encoder.value`]!;
  }
  return out;
}

function tensorDataFloat32(t: Tensor): Float32Array {
  return t.data instanceof Float32Array ? t.data : new Float32Array(t.data as ArrayLike<number>);
}

export async function createSpeechT5Stack(payload: {
  encoderModel: ArrayBuffer;
  decoderModel: ArrayBuffer;
  postnetModel: ArrayBuffer;
  tokenizer: SpeechT5Tokenizer;
}): Promise<SpeechT5Stack> {
  const ort = await import('onnxruntime-web/wasm');
  ort.env.wasm.wasmPaths = wasmOrigin();
  const opts = { executionProviders: ['wasm'] as const };
  const encoder = await ort.InferenceSession.create(payload.encoderModel, opts);
  const decoder = await ort.InferenceSession.create(payload.decoderModel, opts);
  const postnet = await ort.InferenceSession.create(payload.postnetModel, opts);

  const synthesize = async (text: string, speakerEmbedding: Float32Array): Promise<Float32Array> => {
    const inputIds = payload.tokenizer.encode(text);
    const attentionMask = new Int32Array(inputIds.length).fill(1);
    const encFeeds: Record<string, Tensor> = {};
    const encInputName = encoder.inputNames.includes('input_ids') ? 'input_ids' : encoder.inputNames[0]!;
    encFeeds[encInputName] = new ort.Tensor('int64', BigInt64Array.from(inputIds, BigInt), [1, inputIds.length]);
    if (encoder.inputNames.includes('attention_mask')) {
      encFeeds.attention_mask = new ort.Tensor('int64', BigInt64Array.from(attentionMask, BigInt), [
        1,
        attentionMask.length,
      ]);
    }
    const encOut = await encoder.run(encFeeds);
    const hiddenKey =
      encoder.outputNames.find((n) => n.includes('hidden')) ??
      encoder.outputNames[0] ??
      'last_hidden_state';
    const maskKey =
      encoder.outputNames.find((n) => n.includes('attention_mask')) ?? 'encoder_attention_mask';
    const encoderHidden = encOut[hiddenKey] as Tensor;
    let encoderMask = encOut[maskKey] as Tensor | undefined;
    if (!encoderMask) {
      encoderMask = new ort.Tensor('int64', BigInt64Array.from(attentionMask, BigInt), [1, attentionMask.length]);
    }

    const seqLen = encoderHidden.dims[1] ?? inputIds.length;
    const minLen = Math.floor((seqLen * MINLEN_RATIO) / REDUCTION_FACTOR);
    const maxLen = Math.floor((seqLen * MAXLEN_RATIO) / REDUCTION_FACTOR);

    const speaker = speakerEmbedding.length === 512 ? speakerEmbedding : speakerEmbedding.slice(0, 512);
    const speakerTensor = new ort.Tensor('float32', speaker, [1, 512]);

    const spectrogramChunks: Float32Array[] = [];
    let decoderOutputs: Record<string, Tensor> = {};
    let crossAttentionPkv: Record<string, Tensor> = {};
    let useCacheBranch = false;
    let step = 0;

    for (;;) {
      step += 1;
      const feeds: Record<string, Tensor> = {
        use_cache_branch: new ort.Tensor('bool', [useCacheBranch], [1]),
        encoder_attention_mask: encoderMask,
        speaker_embeddings: speakerTensor,
      };

      if (!useCacheBranch) {
        Object.assign(feeds, fakePastKeyValues(ort));
        feeds.output_sequence = new ort.Tensor('float32', new Float32Array(NUM_MEL_BINS), [1, 1, NUM_MEL_BINS]);
        feeds.encoder_hidden_states = encoderHidden;
        useCacheBranch = true;
      } else {
        Object.assign(feeds, realPastKeyValues(ort, decoderOutputs, crossAttentionPkv));
        feeds.output_sequence = decoderOutputs.output_sequence_out as Tensor;
        feeds.encoder_hidden_states = new ort.Tensor('float32', new Float32Array(0), [1, 0, HIDDEN]);
      }

      const runOut = await decoder.run(feeds);
      decoderOutputs = runOut as Record<string, Tensor>;
      if (step === 1) {
        crossAttentionPkv = {};
        for (const [key, val] of Object.entries(decoderOutputs)) {
          if (key.includes('encoder') && key.includes('present')) crossAttentionPkv[key] = val as Tensor;
        }
      }

      const prob = tensorDataFloat32(decoderOutputs.prob as Tensor);
      const spectrum = tensorDataFloat32(decoderOutputs.spectrum as Tensor);
      spectrogramChunks.push(spectrum.slice());

      let stop = false;
      if (step >= minLen) {
        for (let i = 0; i < prob.length; i += 1) {
          if (prob[i]! >= THRESHOLD) {
            stop = true;
            break;
          }
        }
        if (step >= maxLen) stop = true;
      }
      if (stop) break;
    }

    const melFrames = spectrogramChunks.length;
    const mel = new Float32Array(melFrames * NUM_MEL_BINS);
    for (let f = 0; f < melFrames; f += 1) {
      mel.set(spectrogramChunks[f]!.subarray(0, NUM_MEL_BINS), f * NUM_MEL_BINS);
    }

    const postInName = postnet.inputNames[0] ?? 'spectrogram';
    const postOut = await postnet.run({
      [postInName]: new ort.Tensor('float32', mel, [melFrames, NUM_MEL_BINS]),
    });
    const waveKey = postnet.outputNames[0] ?? Object.keys(postOut)[0]!;
    const wave = tensorDataFloat32(postOut[waveKey] as Tensor);
    return wave;
  };

  return {
    synthesize,
    async dispose() {
      await encoder.release();
      await decoder.release();
      await postnet.release();
    },
  };
}
