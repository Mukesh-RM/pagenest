/** UI-safe pairing code helpers (keeps worker crypto out of the lazy Settings sync chunk). */

export function normalizePairingCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function generatePairingCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
