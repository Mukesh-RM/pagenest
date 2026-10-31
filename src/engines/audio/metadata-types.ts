import type { AudioChapter } from './types';

export type MetadataJobKind = 'id3' | 'm4b';

export interface MetadataRequest {
  readonly id: number;
  readonly kind: MetadataJobKind;
  readonly buffer: ArrayBuffer;
}

export interface MetadataResponse {
  readonly id: number;
  readonly chapters: AudioChapter[];
  readonly durationSec?: number;
  readonly error?: string;
}
