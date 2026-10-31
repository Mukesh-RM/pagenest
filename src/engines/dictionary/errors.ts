export type DictionaryErrorCode = 'pack-missing' | 'download-failed' | 'unsupported' | 'aborted';

export class DictionaryError extends Error {
  readonly code: DictionaryErrorCode;
  constructor(code: DictionaryErrorCode, message: string) {
    super(message);
    this.name = 'DictionaryError';
    this.code = code;
  }
}

export function dictionaryError(code: DictionaryErrorCode, message: string): DictionaryError {
  return new DictionaryError(code, message);
}
