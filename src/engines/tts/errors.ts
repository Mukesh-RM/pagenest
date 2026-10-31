import type { VoiceEngineError, VoiceEngineErrorCode } from './types';

export function voiceError(code: VoiceEngineErrorCode, message: string): VoiceEngineError {
  const err = new Error(message) as VoiceEngineError;
  Object.defineProperty(err, 'code', { value: code });
  return err;
}
