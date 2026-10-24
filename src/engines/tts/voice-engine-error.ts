import type { VoiceEngineError, VoiceEngineErrorCode } from './types';

export function createVoiceEngineError(
  code: VoiceEngineErrorCode,
  message: string,
): VoiceEngineError {
  const error = new Error(message) as VoiceEngineError;
  error.name = 'VoiceEngineError';
  Object.defineProperty(error, 'code', { value: code, enumerable: true });
  return error;
}

export function isVoiceEngineError(value: unknown): value is VoiceEngineError {
  return (
    value instanceof Error &&
    (value as VoiceEngineError).name === 'VoiceEngineError' &&
    typeof (value as VoiceEngineError).code === 'string'
  );
}
