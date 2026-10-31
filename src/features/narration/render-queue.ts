import type { EntityId } from '@/app/contracts';
import type { NarrationStyle, RenderRecord } from '@/data/schema';
import type { FileStore } from '@/data/opfs';
import type { VoiceEngine } from '@/engines/tts/types';
import { buildNarrationPlan } from '@/engines/emotion/pipeline';
import { encodeWav, renderAudioPath } from './wav-encode';

export interface RenderQueueDeps {
  readonly files: FileStore;
  readonly engine: VoiceEngine;
  readonly voiceId: string;
  readonly style: NarrationStyle;
}

/** Render one chapter to OPFS and update the render row. */
export async function renderChapter(
  deps: RenderQueueDeps,
  bookId: EntityId,
  chapterIndex: number,
  chapterText: string,
  onStatus?: (status: RenderRecord['status']) => void,
): Promise<RenderRecord> {
  onStatus?.('rendering');
  const plan = buildNarrationPlan(chapterText, deps.style);
  await deps.engine.prepareVoice(deps.voiceId, { allowDownload: true });
  const chunks: { samples: Float32Array; sampleRate: number }[] = [];
  for (const sentence of plan) {
    const result = await deps.engine.synthesize({
      voiceId: deps.voiceId,
      text: sentence.text,
      language: 'en-US',
      delivery: sentence.delivery,
    });
    if (result.kind !== 'buffer') continue;
    chunks.push({ samples: result.samples, sampleRate: result.sampleRate });
  }
  const merged = chunks.length ? concatMerged(chunks) : new Float32Array(0);
  const rate = chunks[0]?.sampleRate ?? 22050;
  const blob = encodeWav(merged, rate);
  const path = renderAudioPath(bookId, chapterIndex, deps.voiceId, deps.style);
  await deps.files.write(path, blob);
  const row: RenderRecord = {
    bookId,
    chapterIndex,
    voiceId: deps.voiceId,
    style: deps.style,
    status: 'ready',
    audioRef: path,
  };
  onStatus?.('ready');
  return row;
}

function concatMerged(chunks: { samples: Float32Array; sampleRate: number }[]): Float32Array {
  const total = chunks.reduce((n, c) => n + c.samples.length, 0);
  const out = new Float32Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c.samples, off);
    off += c.samples.length;
  }
  return out;
}
