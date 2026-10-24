/**
 * Pause durations after sentences and paragraph breaks (PCM silence insertion).
 * Durations are tuned for expressive read-aloud; values are estimates pending listening tests.
 */

export interface PausePlan {
  /** Silence after this sentence, in milliseconds. */
  readonly pauseAfterMs: number;
  /** Extra silence before the next paragraph (added to pauseAfterMs). */
  readonly paragraphBreakMs: number;
}

export interface PausePlannerOptions {
  /** Base pause after `.` `?` `!` */
  readonly sentenceEndMs?: number;
  readonly commaMs?: number;
  readonly semicolonMs?: number;
  readonly paragraphBreakMs?: number;
}

const DEFAULTS: PausePlannerOptions = {
  sentenceEndMs: 380,
  commaMs: 160,
  semicolonMs: 240,
  paragraphBreakMs: 520,
};

/** Plan trailing silence from sentence-ending punctuation (per-sentence pacing). */
export function planPauseAfterSentence(
  sentence: string,
  options: PausePlannerOptions = {},
): PausePlan {
  const opts = { ...DEFAULTS, ...options };
  const trimmed = sentence.trimEnd();
  let pauseAfterMs = opts.sentenceEndMs ?? 380;

  if (trimmed.endsWith(',') || trimmed.endsWith(';')) {
    pauseAfterMs = opts.semicolonMs ?? 240;
  }
  if (trimmed.endsWith(',')) {
    pauseAfterMs = opts.commaMs ?? 160;
  }
  if (trimmed.endsWith('...') || trimmed.endsWith('…')) {
    pauseAfterMs = (opts.sentenceEndMs ?? 380) + 180;
  }

  return {
    pauseAfterMs,
    paragraphBreakMs: opts.paragraphBreakMs ?? 520,
  };
}

export function isParagraphBreak(previous: string | undefined, next: string | undefined): boolean {
  if (!previous || !next) {
    return false;
  }
  return previous.includes('\n\n') || next.startsWith('\n') || /\n\s*\n/.test(`${previous}\n${next}`);
}

/** Append silence samples (mono float32, -1..1). */
export function appendSilencePcm(
  samples: Float32Array,
  sampleRate: number,
  pauseMs: number,
): Float32Array {
  if (pauseMs <= 0) {
    return samples;
  }
  const extra = Math.round((sampleRate * pauseMs) / 1000);
  const out = new Float32Array(samples.length + extra);
  out.set(samples);
  return out;
}
