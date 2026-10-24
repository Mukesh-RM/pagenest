/**
 * Sample content for the dev gallery and the tests. It lives in src/ui/demo on purpose: nothing in the
 * production bundle imports it (a test and the build check both enforce that). All titles, names and text are
 * invented; the covers are drawn here as SVG, so no third-party artwork is involved.
 */
import type { BookDetail, BookSummary, ReaderFontOption, ReaderSettings, VoiceOption } from '../types';

interface CoverSpec {
  bg: string;
  fg: string;
  accent: string;
  kind: 'sun' | 'stripes' | 'frame' | 'grid' | 'hills' | 'moon' | 'circles' | 'block';
}

const esc = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Greedy word wrap on a character budget per line. */
function wrap(text: string, max: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1]!.replace(/\s*\S*$/, '') + '…';
    return kept;
  }
  return lines;
}

function art(kind: CoverSpec['kind'], accent: string, fg: string): string {
  switch (kind) {
    case 'sun':
      return `<circle cx="200" cy="360" r="92" fill="${accent}"/><rect x="0" y="360" width="400" height="240" fill="${fg}" opacity=".16"/>`;
    case 'stripes':
      return [0, 1, 2, 3, 4, 5].map((i) => `<rect x="0" y="${330 + i * 22}" width="400" height="10" fill="${accent}" opacity="${0.9 - i * 0.13}"/>`).join('');
    case 'frame':
      return `<rect x="44" y="300" width="312" height="236" fill="none" stroke="${accent}" stroke-width="6"/><rect x="64" y="320" width="272" height="196" fill="none" stroke="${fg}" stroke-width="2" opacity=".5"/>`;
    case 'grid':
      return Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 6 }, (_, c) => `<rect x="${52 + c * 52}" y="${312 + r * 44}" width="40" height="32" fill="${(r + c) % 3 === 0 ? accent : fg}" opacity="${(r + c) % 3 === 0 ? 1 : 0.2}"/>`).join(''),
      ).join('');
    case 'hills':
      return `<path d="M0 470 Q100 360 200 440 T400 400 V600 H0Z" fill="${accent}"/><path d="M0 520 Q120 450 240 510 T400 480 V600 H0Z" fill="${fg}" opacity=".22"/>`;
    case 'moon':
      return `<circle cx="270" cy="350" r="74" fill="${accent}"/><circle cx="302" cy="334" r="66" fill="${fg}" opacity="0"/><path d="M0 520 H400 V600 H0Z" fill="${fg}" opacity=".2"/>`;
    case 'circles':
      return `<circle cx="140" cy="420" r="78" fill="none" stroke="${accent}" stroke-width="10"/><circle cx="230" cy="420" r="78" fill="none" stroke="${fg}" stroke-width="4" opacity=".6"/><circle cx="185" cy="470" r="78" fill="none" stroke="${accent}" stroke-width="4" opacity=".7"/>`;
    case 'block':
    default:
      return `<rect x="0" y="330" width="400" height="120" fill="${accent}"/><rect x="0" y="470" width="400" height="14" fill="${fg}" opacity=".5"/>`;
  }
}

/** A 2:3 cover as an SVG data URL: title, author and one simple graphic. */
export function coverDataUrl(title: string, author: string, spec: CoverSpec): string {
  const titleLines = wrap(title, 13, 4);
  const authorLines = wrap(author, 24, 2);
  const titleSvg = titleLines
    .map((l, i) => `<text x="36" y="${96 + i * 46}" font-family="Georgia, 'Times New Roman', serif" font-size="40" font-weight="700" fill="${spec.fg}">${esc(l)}</text>`)
    .join('');
  const authorSvg = authorLines
    .map((l, i) => `<text x="36" y="${548 + i * 24}" font-family="Arial, Helvetica, sans-serif" font-size="19" letter-spacing="2" fill="${spec.fg}" opacity=".85">${esc(l.toUpperCase())}</text>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600"><rect width="400" height="600" fill="${spec.bg}"/>${art(spec.kind, spec.accent, spec.fg)}${titleSvg}${authorSvg}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface SampleRow {
  id: string;
  title: string;
  author?: string;
  progress: number;
  audio?: boolean;
  cover?: CoverSpec;
}

const ROWS: readonly SampleRow[] = [
  { id: 'b01', title: 'The Orchard at the End of Winter', author: 'Marguerite Aldous', progress: 0.42, audio: true, cover: { bg: '#264653', fg: '#f4ead5', accent: '#e9c46a', kind: 'sun' } },
  { id: 'b02', title: 'Salt, Light and Other Small Mercies: Essays from a Coastal Year', author: 'Tobias Wren-Hallett and Imani Okonkwo-Reyes, with a foreword by Jun Takeda', progress: 0.08, cover: { bg: '#f1e3c6', fg: '#3b2f23', accent: '#bc4b51', kind: 'stripes' } },
  { id: 'b03', title: 'Field Notes on Quiet', author: 'Ana Lindqvist', progress: 0, cover: { bg: '#e8efe9', fg: '#1f3a35', accent: '#2f6f6b', kind: 'frame' } },
  { id: 'b04', title: 'A Brief History of Rivers', author: 'Daniel Osei', progress: 1, cover: { bg: '#1d3557', fg: '#f1faee', accent: '#8fd3cc', kind: 'hills' } },
  { id: 'b05', title: 'Nightjar', author: 'Priya Raman', progress: 0.87, audio: true, cover: { bg: '#1b1b2f', fg: '#efe9f4', accent: '#f6c177', kind: 'moon' } },
  { id: 'b06', title: 'The Cartographer’s Daughter', author: 'Elena Marchetti', progress: 0.15, cover: { bg: '#8c5a3c', fg: '#fbf1e1', accent: '#f0d9a8', kind: 'circles' } },
  { id: 'b07', title: 'Small Hours', author: 'Kenji Mori', progress: 0.63, audio: true, cover: { bg: '#2d1e2f', fg: '#fde8e0', accent: '#ef8354', kind: 'block' } },
  { id: 'b08', title: 'Ten Thousand Steps to the Sea', author: 'Rosalind Achterberg', progress: 0.27, cover: { bg: '#d9e8f2', fg: '#12324a', accent: '#3a7ca5', kind: 'grid' } },
  { id: 'b09', title: 'What the Lighthouse Keeper Knew', author: 'Callum Fairweather', progress: 0.5, audio: true, cover: { bg: '#fff1e6', fg: '#4a1f1f', accent: '#c1443c', kind: 'sun' } },
  { id: 'b10', title: 'Bread, Slowly', author: 'Noor Haddad', progress: 0.94, cover: { bg: '#f6e7cb', fg: '#4b3621', accent: '#b5651d', kind: 'circles' } },
  { id: 'b11', title: 'The Long Way to Lisbon', author: 'Maren Solheim', progress: 0.33, cover: { bg: '#0f3d3e', fg: '#e6f4f1', accent: '#f4a259', kind: 'hills' } },
  { id: 'b12', title: 'Glass Gardens', author: 'Ishaan Verma', progress: 0.71, audio: true, cover: { bg: '#e6eef4', fg: '#233447', accent: '#5b8e7d', kind: 'frame' } },
  { id: 'b13', title: 'Letters from the Lowlands', author: 'Hugh Pemberton', progress: 0.6 },
  { id: 'b14', title: 'Mathematics for the Curious Mind: An Illustrated Journey Through Numbers, Patterns and Proofs', author: 'Dr. Sofia Alvarenga', progress: 0.02 },
  { id: 'b15', title: 'Untitled Scans, Box 4', progress: 0.11 },
  { id: 'b16', title: 'Evening Songs', author: 'Lucía Fernández-Ortega and the Harbour Choir', progress: 0.38, audio: true },
];

/** 16 books: 12 with generated covers, 4 without; long titles, two-line authors, 0 % and 100 % progress. */
export const SAMPLE_BOOKS: readonly BookSummary[] = ROWS.map((row) => ({
  id: row.id,
  title: row.title,
  author: row.author,
  progress: row.progress,
  audio: row.audio,
  coverUrl: row.cover ? coverDataUrl(row.title, row.author ?? '', row.cover) : undefined,
}));

export const SAMPLE_DETAIL: BookDetail = {
  ...SAMPLE_BOOKS[0]!,
  narrator: 'Eleanor Whitcombe',
  format: 'M4B',
  pages: 312,
  durationSeconds: 9 * 3600 + 41 * 60,
  where: 'chapter 7',
  description:
    'When the last frost lifts, Ines returns to her grandmother’s orchard to settle the estate and stays to learn what the trees remember. A quiet, warm novel about land, inheritance and the slow work of starting again.',
};

export const SAMPLE_DETAIL_LONG: BookDetail = {
  ...SAMPLE_BOOKS[1]!,
  format: 'EPUB',
  pages: 248,
  where: 'page 20',
  description:
    'Twelve months of short essays written on a single stretch of shoreline: tides, weather, a failing ferry timetable and the neighbours who keep the harbour running.',
};

export const SAMPLE_FONTS: readonly ReaderFontOption[] = [
  { id: 'literata', label: 'Literata', family: 'Literata, Georgia, serif' },
  { id: 'inter', label: 'Inter', family: 'Inter, system-ui, sans-serif' },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, "Times New Roman", serif' },
];

export const SAMPLE_READER_SETTINGS: ReaderSettings = {
  fontSize: 18,
  fontId: 'literata',
  theme: 'light',
  lineSpacing: 'comfortable',
  margins: 'medium',
};

export const SAMPLE_CHAPTER = 'Chapter 7: The orchard in March';

export const SAMPLE_PARAGRAPHS: readonly string[] = [
  'By the time Ines reached the gate the frost had gone out of the ground, and the whole hillside smelled of wet bark and woodsmoke. She stood a while with the key in her hand, not yet ready to turn it.',
  'Her grandmother had kept the orchard the way some people keep a diary. Every tree had a small tin tag wired to a low branch, and every tag had a year scratched into it, and sometimes a word: kind, sulks, early, never again. Ines read them as she walked, one row after another, and felt like someone reading over a shoulder.',
  '“You’ll want to prune the old Bramleys before the sap rises,” Mr. Okafor called from the lane. He had appeared the way neighbours do in books and, she was beginning to learn, in life: without a sound, already holding a ladder.',
  'She had meant to sell. She had said so, clearly, on the phone, to three different people. But the light came through the bare branches in long gold bars and lay across the grass, and the kettle in the cottage, when she finally turned the key and found it, was still warm to the touch.',
  'That night she slept with the window open and woke twice to the sound of the wind working through the trees, a long patient sound, like someone turning pages.',
];

export const SAMPLE_VOICES: readonly VoiceOption[] = [
  { id: 'v-amelia', name: 'Amelia', language: 'English (UK)', quality: 'Natural', size: '64 MB', installed: true },
  { id: 'v-noah', name: 'Noah', language: 'English (US)', quality: 'Natural', size: '58 MB', installed: true },
  { id: 'v-priya', name: 'Priya', language: 'English (India)', quality: 'Natural', size: '61 MB' },
  { id: 'v-sam', name: 'Sam', language: 'English (US)', quality: 'Compact', size: '22 MB' },
  { id: 'v-clara', name: 'Clara', language: 'English (Australia)', quality: 'Compact', size: '24 MB' },
];

export const SAMPLE_CHAPTERS: readonly string[] = [
  'Chapter 5: The tin tags',
  'Chapter 6: Mr. Okafor’s ladder',
  'Chapter 7: The orchard in March',
  'Chapter 8: What the frost left',
];
