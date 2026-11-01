/**
 * Encrypt sync payloads with a one-time pairing code (Web Crypto only, no third-party crypto).
 */

const PBKDF2_ITERATIONS = 120_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedSyncBlob {
  format: 'pagenest-sync-encrypted';
  version: 1;
  /** Base64 salt for PBKDF2. */
  salt: string;
  /** Base64 AES-GCM IV. */
  iv: string;
  /** Base64 ciphertext (includes GCM tag). */
  data: string;
}

export class SyncCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncCryptoError';
  }
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function normalizePairingCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

/** Six easy-to-read characters for the on-screen code (no 0/O or 1/I). */
export function generatePairingCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

async function deriveKey(code: string, salt: Uint8Array): Promise<CryptoKey> {
  const normalized = normalizePairingCode(code);
  if (normalized.length < 4) throw new SyncCryptoError('The pairing code is too short.');
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalized), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBytes(plain: Uint8Array, code: string): Promise<EncryptedSyncBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(code, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plain as BufferSource);
  return {
    format: 'pagenest-sync-encrypted',
    version: 1,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    data: bytesToB64(new Uint8Array(cipher)),
  };
}

export async function decryptBytes(blob: EncryptedSyncBlob, code: string): Promise<Uint8Array> {
  if (blob.format !== 'pagenest-sync-encrypted' || blob.version !== 1) {
    throw new SyncCryptoError('This is not a InkQuiet sync package.');
  }
  try {
    const key = await deriveKey(code, b64ToBytes(blob.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(blob.iv) as BufferSource }, key, b64ToBytes(blob.data) as BufferSource);
    return new Uint8Array(plain);
  } catch {
    throw new SyncCryptoError('The pairing code does not match, or the sync data is damaged.');
  }
}

export async function encryptJson(value: unknown, code: string): Promise<EncryptedSyncBlob> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  return encryptBytes(json, code);
}

export async function decryptJson<T>(blob: EncryptedSyncBlob, code: string): Promise<T> {
  const bytes = await decryptBytes(blob, code);
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new SyncCryptoError('The sync data is damaged.');
  }
}

/** Compact JSON string for QR chunks (encrypted envelope). */
export function serializeEncrypted(blob: EncryptedSyncBlob): string {
  return JSON.stringify(blob);
}

export function parseEncrypted(raw: string): EncryptedSyncBlob {
  try {
    const parsed = JSON.parse(raw) as EncryptedSyncBlob;
    if (parsed?.format !== 'pagenest-sync-encrypted') throw new SyncCryptoError('This QR code is not from InkQuiet.');
    return parsed;
  } catch (error) {
    if (error instanceof SyncCryptoError) throw error;
    throw new SyncCryptoError('This QR code is not from InkQuiet.');
  }
}
