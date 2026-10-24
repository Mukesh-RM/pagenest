import type { ReaderError, ReaderErrorCode } from '@/engines/reader/types';

/** Plain-word messages shown to people (blueprint 5.8): never codes or stack traces. */
export const READER_ERROR_MESSAGES: Readonly<Record<ReaderErrorCode, string>> = {
  drm: 'This file is protected by DRM, so PageNest cannot open it.',
  corrupt: 'This file looks damaged. Try another copy.',
  unsupported: 'PageNest cannot open this kind of file yet.',
  aborted: 'Opening was cancelled.',
};

/** Create the {@link ReaderError} engines throw. `message` defaults to the plain-word text for the code. */
export function readerError(code: ReaderErrorCode, message: string = READER_ERROR_MESSAGES[code], cause?: unknown): ReaderError {
  const error = new Error(message, cause === undefined ? undefined : { cause }) as Error & { code: ReaderErrorCode };
  error.name = 'ReaderError';
  error.code = code;
  return error as ReaderError;
}

export function isReaderError(value: unknown): value is ReaderError {
  if (!(value instanceof Error)) return false;
  const code = (value as { code?: unknown }).code;
  return code === 'drm' || code === 'corrupt' || code === 'unsupported' || code === 'aborted';
}

/** Throw `aborted` when the signal fired. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw readerError('aborted');
}

/** Turn anything an engine or library threw into a ReaderError whose message is safe to show. */
export function toReaderError(error: unknown, fallback: ReaderErrorCode = 'corrupt'): ReaderError {
  if (isReaderError(error)) return error;
  if (error instanceof DOMException && error.name === 'AbortError') return readerError('aborted', undefined, error);
  return readerError(fallback, undefined, error);
}
