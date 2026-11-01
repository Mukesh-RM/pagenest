import type { SynthesisRequest, SynthesisResult, VoiceAvailability, VoiceEngine, VoiceInfo } from './types';
import { voiceError } from './errors';

export const SPEECH_VOICE_PREFIX = 'speech-';

/** Stable id for a {@link SpeechSynthesisVoice} (stored in narration settings). */
export function speechVoiceIdFrom(v: SpeechSynthesisVoice): string {
  return `${SPEECH_VOICE_PREFIX}${encodeURIComponent(v.voiceURI)}`;
}

export function parseSpeechVoiceUri(voiceId: string): string | undefined {
  if (!voiceId.startsWith(SPEECH_VOICE_PREFIX)) return undefined;
  try {
    return decodeURIComponent(voiceId.slice(SPEECH_VOICE_PREFIX.length));
  } catch {
    return undefined;
  }
}

export function isSpeechVoiceId(voiceId: string): boolean {
  return voiceId.startsWith(SPEECH_VOICE_PREFIX);
}

/** Android Chrome loads {@link speechSynthesis.getVoices} asynchronously. */
export function waitForSpeechVoices(timeoutMs = 15_000): Promise<void> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve();
  if (speechSynthesis.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = (): void => {
      speechSynthesis.removeEventListener('voiceschanged', onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = (): void => {
      if (speechSynthesis.getVoices().length > 0) finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    speechSynthesis.addEventListener('voiceschanged', onChange);
    speechSynthesis.getVoices();
  });
}

export function pickDefaultSpeechVoice(voices: readonly VoiceInfo[], language?: string): VoiceInfo | undefined {
  const lang = language?.slice(0, 2).toLowerCase();
  const device = voices.filter((v) => v.engine === 'speech');
  if (!device.length) return undefined;
  if (lang) {
    const match = device.find((v) => v.language.toLowerCase().startsWith(lang));
    if (match) return match;
  }
  return device[0];
}

export function speechSynthesisPaused(): boolean {
  return typeof speechSynthesis !== 'undefined' && speechSynthesis.paused;
}

export function speechSynthesisSpeaking(): boolean {
  return typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking;
}

export function pauseSpeechSynthesis(): void {
  speechSynthesis?.pause();
}

export function resumeSpeechSynthesis(): void {
  speechSynthesis?.resume();
}

export function cancelSpeechSynthesis(): void {
  speechSynthesis?.cancel();
}

/** Tier 0 fallback: browser speech synthesis (foreground only). */
export function createSpeechEngine(): VoiceEngine {
  return {
    id: 'speech',
    tier: 0,
    capabilities: {
      output: 'live',
      backgroundSafe: false,
      supportsProsody: true,
      supportsEmotion: false,
      supportsOwnVoice: false,
      needsDownload: false,
    },
    async checkAvailability(): Promise<VoiceAvailability> {
      if (typeof speechSynthesis === 'undefined') return { available: false, reason: 'Speech synthesis is not supported here.' };
      await waitForSpeechVoices();
      return { available: true };
    },
    async listVoices(language?: string): Promise<readonly VoiceInfo[]> {
      if (typeof speechSynthesis === 'undefined') return [];
      await waitForSpeechVoices();
      const lang = language?.slice(0, 2).toLowerCase();
      return speechSynthesis
        .getVoices()
        .filter((v) => !lang || v.lang.toLowerCase().startsWith(lang))
        .map((v) => ({
          id: speechVoiceIdFrom(v),
          name: v.name,
          engine: 'speech',
          language: v.lang,
          isOwnVoice: false,
          installed: true,
        }));
    },
    async prepareVoice(): Promise<void> {
      await waitForSpeechVoices();
    },
    async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
      if (typeof speechSynthesis === 'undefined') throw voiceError('unavailable', 'Speech synthesis is not supported here.');
      await waitForSpeechVoices();
      await speak(request);
      return { kind: 'live' };
    },
    async dispose(): Promise<void> {
      cancelSpeechSynthesis();
    },
  };
}

function resolveVoice(voiceId: string, language: string): SpeechSynthesisVoice | undefined {
  const uri = parseSpeechVoiceUri(voiceId);
  const voices = speechSynthesis.getVoices();
  if (uri) {
    const exact = voices.find((v) => v.voiceURI === uri);
    if (exact) return exact;
  }
  const lang = language.slice(0, 2).toLowerCase();
  return voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? voices[0];
}

function speak(request: SynthesisRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    cancelSpeechSynthesis();
    const u = new SpeechSynthesisUtterance(request.text);
    u.lang = request.language;
    u.rate = Math.max(0.1, Math.min(10, request.delivery.rate));
    u.pitch = Math.max(0, Math.min(2, 1 + request.delivery.pitch / 12));
    u.volume = Math.min(1, request.delivery.volume);
    const voice = resolveVoice(request.voiceId, request.language);
    if (voice) {
      try {
        u.voice = voice;
      } catch {
        /* stubbed or mismatched voices: lang + name still apply */
      }
    }

    const onAbort = (): void => {
      cancelSpeechSynthesis();
      reject(voiceError('aborted', 'Read aloud stopped.'));
    };
    request.signal?.addEventListener('abort', onAbort, { once: true });

    u.onend = () => {
      request.signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    u.onerror = (ev) => {
      request.signal?.removeEventListener('abort', onAbort);
      if (request.signal?.aborted) {
        reject(voiceError('aborted', 'Read aloud stopped.'));
        return;
      }
      const err = ev.error ?? 'Speech synthesis failed.';
      reject(voiceError('failed', typeof err === 'string' ? err : 'Speech synthesis failed.'));
    };
    speechSynthesis.speak(u);
  });
}
