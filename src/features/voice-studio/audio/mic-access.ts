import { consentPhraseMatches } from '../consent/verify';

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript?: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onnomatch: (() => void) | null;
  start(): void;
  stop(): void;
};

export type MicPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied';

export interface ConsentRecognitionResult {
  readonly transcript: string;
  readonly matched: boolean;
}

export interface ConsentRecognizer {
  start(expectedPhrase: string, signal?: AbortSignal): Promise<ConsentRecognitionResult>;
}

/** Browser SpeechRecognition when available; resolves with transcript for {@link consentPhraseMatches}. */
export function createBrowserConsentRecognizer(): ConsentRecognizer | undefined {
  const W = window as typeof window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!Ctor) return undefined;

  return {
    start(expectedPhrase, signal) {
      return new Promise((resolve, reject) => {
        const rec = new Ctor();
        rec.lang = 'en-US';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        let done = false;
        const finish = (result: ConsentRecognitionResult) => {
          if (done) return;
          done = true;
          rec.stop();
          resolve(result);
        };
        const fail = (err: unknown) => {
          if (done) return;
          done = true;
          rec.stop();
          reject(err instanceof Error ? err : new Error(String(err)));
        };
        signal?.addEventListener('abort', () => fail(new DOMException('Aborted', 'AbortError')), { once: true });
        rec.onresult = (ev) => {
          const transcript = ev.results[0]?.[0]?.transcript ?? '';
          finish({ transcript, matched: consentPhraseMatches(expectedPhrase, transcript) });
        };
        rec.onerror = () => fail(new Error('Speech recognition could not verify the phrase. Try again in a quiet room.'));
        rec.onnomatch = () => finish({ transcript: '', matched: false });
        try {
          rec.start();
        } catch (e) {
          fail(e);
        }
      });
    },
  };
}

export async function queryMicPermission(): Promise<MicPermissionState> {
  if (!navigator.mediaDevices?.getUserMedia) return 'denied';
  try {
    const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    if (perm.state === 'granted') return 'granted';
    if (perm.state === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'unknown';
  }
}

export async function requestMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
}
