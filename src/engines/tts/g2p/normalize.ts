const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const ABBREV: Readonly<Record<string, string>> = {
  mr: 'mister',
  mrs: 'missus',
  ms: 'ms',
  dr: 'doctor',
  prof: 'professor',
  st: 'saint',
  vs: 'versus',
  etc: 'etcetera',
  'e.g': 'for example',
  'i.e': 'that is',
};

/** Light English normalizer for G2P (numbers, common titles, punctuation spacing). */
export function normalizeEnglishForG2p(text: string): string {
  let out = text.replace(/\u2019/g, "'").replace(/\s+/g, ' ').trim();
  out = out.replace(/\b(\d{1,2})\b/g, (_, n: string) => numberWord(parseInt(n, 10)));
  out = out.replace(/\b(\d{4})\b/g, (_, y: string) => yearWords(y));
  out = out.replace(/\b([A-Za-z]{1,4})\./g, (match, abbr: string) => {
    const key = abbr.toLowerCase();
    return ABBREV[key] ? `${ABBREV[key]} ` : match;
  });
  out = out.replace(/[^\w\s',.?!-]/g, ' ');
  return out.replace(/\s+/g, ' ').trim();
}

function numberWord(n: number): string {
  if (n < 20) return ONES[n] ?? String(n);
  if (n < 100) {
    const t = Math.floor(n / 10);
    const r = n % 10;
    return r === 0 ? TENS[t] ?? String(n) : `${TENS[t]}-${ONES[r]}`;
  }
  return String(n);
}

function yearWords(y: string): string {
  const n = parseInt(y, 10);
  if (n >= 2000 && n < 2010) return `two thousand ${numberWord(n - 2000)}`;
  if (n >= 2010 && n < 2100) return `twenty ${numberWord(n - 2000)}`;
  return y;
}

export function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9']+/i)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length > 0);
}
