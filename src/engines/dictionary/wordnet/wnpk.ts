import type { DefinitionResult, DefinitionSense } from '../types';
import { normalizeWord } from './lexicon';

const MAGIC = 0x4b504e57;

interface IndexRow {
  readonly word: string;
  readonly dataOffset: number;
  readonly dataLen: number;
}

export interface WordnetIndex {
  readonly define: (word: string) => DefinitionResult;
  readonly entryCount: number;
}

function parseIndex(bytes: Uint8Array, indexStart: number, indexEnd: number, dataStart: number): IndexRow[] {
  const decoder = new TextDecoder();
  const rows: IndexRow[] = [];
  let at = indexStart;
  while (at < indexEnd) {
    const wLen = bytes[at]!;
    const word = decoder.decode(bytes.subarray(at + 1, at + 1 + wLen));
    const dataOffset =
      (bytes[at + 1 + wLen]! << 24) |
      (bytes[at + 1 + wLen + 1]! << 16) |
      (bytes[at + 1 + wLen + 2]! << 8) |
      bytes[at + 1 + wLen + 3]!;
    const dataLen = (bytes[at + 1 + wLen + 4]! << 8) | bytes[at + 1 + wLen + 5]!;
    rows.push({ word, dataOffset: dataStart + dataOffset, dataLen });
    at += 1 + wLen + 6;
  }
  return rows;
}

/** Open a WNPK v1 pack. Index is parsed once; each lookup is a binary search (fast after lazy open). */
export function openWordnetPack(buffer: ArrayBuffer): WordnetIndex {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== MAGIC) throw new Error('Not a WNPK dictionary pack.');
  if (view.getUint16(4, true) !== 1) throw new Error('Unsupported WNPK version.');
  const entryCount = view.getUint32(8, true);
  const indexStart = view.getUint32(12, true);
  const dataStart = view.getUint32(16, true);
  const bytes = new Uint8Array(buffer);
  const rows = parseIndex(bytes, indexStart, indexStart + view.getUint32(20, true), dataStart);
  const decoder = new TextDecoder();

  const define = (raw: string): DefinitionResult => {
    const key = normalizeWord(raw);
    if (!key) return { word: key, senses: [], source: 'none' };
    let lo = 0;
    let hi = rows.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const row = rows[mid]!;
      if (row.word === key) {
        const blob = decoder.decode(bytes.subarray(row.dataOffset, row.dataOffset + row.dataLen));
        const [posLine, ...glosses] = blob.split('\n');
        const senses: DefinitionSense[] = [{ pos: posLine ?? 'n', glosses: glosses.filter(Boolean) }];
        return { word: key, senses, source: 'wordnet' };
      }
      if (row.word < key) lo = mid + 1;
      else hi = mid - 1;
    }
    return { word: key, senses: [], source: 'none' };
  };

  return { define, entryCount: entryCount || rows.length };
}

export async function maybeGunzip(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const u8 = new Uint8Array(buffer);
  if (u8[0] === 0x1f && u8[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress dictionary packs.');
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  }
  return buffer;
}
