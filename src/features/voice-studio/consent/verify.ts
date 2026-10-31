/** Normalize speech-to-text output for comparison with the expected consent phrase. */
export function normalizeSpokenText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when the transcript contains every word from the expected phrase in order. */
export function consentPhraseMatches(expected: string, transcript: string): boolean {
  const want = normalizeSpokenText(expected).split(' ').filter(Boolean);
  const got = normalizeSpokenText(transcript).split(' ').filter(Boolean);
  if (want.length === 0 || got.length < want.length) return false;
  let i = 0;
  for (const word of got) {
    if (word === want[i]) {
      i += 1;
      if (i === want.length) return true;
    }
  }
  return false;
}
