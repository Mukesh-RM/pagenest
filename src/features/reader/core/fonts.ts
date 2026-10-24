/**
 * Reading fonts (blueprint 5.3): Literata, Source Serif, Merriweather, Lora, Atkinson Hyperlegible, OpenDyslexic
 * plus the device serif and sans. All files are self-hosted woff2 under `../fonts` (SIL OFL 1.1, see OFL-FONTS.txt).
 */

export interface FontFace {
  readonly file: string;
  readonly style: 'normal' | 'italic';
  /** CSS `font-weight` descriptor: a single weight or a variable range such as "200 900". */
  readonly weight: string;
}

export interface ReadingFont {
  readonly id: string;
  readonly label: string;
  /** Full CSS `font-family` value with fallbacks. */
  readonly family: string;
  /** The first family name, used to recognise the font in `ReaderAppearance.fontFamily`. */
  readonly name: string;
  readonly faces: readonly FontFace[];
}

const VAR = '200 900';

export const READING_FONTS: readonly ReadingFont[] = [
  {
    id: 'literata',
    label: 'Literata',
    name: 'Literata',
    family: "Literata, Georgia, 'Times New Roman', serif",
    faces: [
      { file: 'literata-latin-wght-normal.woff2', style: 'normal', weight: VAR },
      { file: 'literata-latin-wght-italic.woff2', style: 'italic', weight: VAR },
    ],
  },
  {
    id: 'source-serif',
    label: 'Source Serif',
    name: 'Source Serif 4',
    family: "'Source Serif 4', Georgia, 'Times New Roman', serif",
    faces: [
      { file: 'source-serif-4-latin-wght-normal.woff2', style: 'normal', weight: '200 900' },
      { file: 'source-serif-4-latin-wght-italic.woff2', style: 'italic', weight: '200 900' },
    ],
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    name: 'Merriweather',
    family: "Merriweather, Georgia, 'Times New Roman', serif",
    faces: [{ file: 'merriweather-latin-wght-normal.woff2', style: 'normal', weight: '300 900' }],
  },
  {
    id: 'lora',
    label: 'Lora',
    name: 'Lora',
    family: "Lora, Georgia, 'Times New Roman', serif",
    faces: [
      { file: 'lora-latin-wght-normal.woff2', style: 'normal', weight: '400 700' },
      { file: 'lora-latin-wght-italic.woff2', style: 'italic', weight: '400 700' },
    ],
  },
  {
    id: 'atkinson',
    label: 'Atkinson Hyperlegible',
    name: 'Atkinson Hyperlegible',
    family: "'Atkinson Hyperlegible', system-ui, sans-serif",
    faces: [
      { file: 'atkinson-hyperlegible-latin-400-normal.woff2', style: 'normal', weight: '400' },
      { file: 'atkinson-hyperlegible-latin-700-normal.woff2', style: 'normal', weight: '700' },
      { file: 'atkinson-hyperlegible-latin-400-italic.woff2', style: 'italic', weight: '400' },
    ],
  },
  {
    id: 'opendyslexic',
    label: 'OpenDyslexic',
    name: 'OpenDyslexic',
    family: "OpenDyslexic, system-ui, sans-serif",
    faces: [
      { file: 'opendyslexic-latin-400-normal.woff2', style: 'normal', weight: '400' },
      { file: 'opendyslexic-latin-700-normal.woff2', style: 'normal', weight: '700' },
    ],
  },
  {
    id: 'system-serif',
    label: 'Device serif',
    name: 'ui-serif',
    family: "ui-serif, Georgia, Cambria, 'Times New Roman', serif",
    faces: [],
  },
  {
    id: 'system-sans',
    label: 'Device sans',
    name: 'system-ui',
    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    faces: [],
  },
];

export const DEFAULT_FONT = READING_FONTS[0] as ReadingFont;

/** The reading font that `fontFamily` (a CSS font-family value) names; falls back to the default. */
export function fontForFamily(fontFamily: string): ReadingFont {
  const first = fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '').toLowerCase() ?? '';
  return READING_FONTS.find((f) => f.name.toLowerCase() === first || f.id === first) ?? DEFAULT_FONT;
}

/** Map of file name to served URL. Vite fills this in at build time; tests get the raw path. */
const urls = import.meta.glob('../fonts/*.woff2', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export function fontFileUrl(file: string): string | undefined {
  const url = urls[`../fonts/${file}`];
  if (!url) return undefined;
  // Documents rendered in blob: iframes need an absolute URL.
  return typeof location !== 'undefined' ? new URL(url, location.href).href : url;
}

/** `@font-face` rules for one font. Weights use `font-display: swap` so text shows at once. */
export function fontFaceCss(font: ReadingFont): string {
  return font.faces
    .map((face) => {
      const url = fontFileUrl(face.file);
      if (!url) return '';
      return `@font-face{font-family:${font.name.includes(' ') ? `'${font.name}'` : font.name};font-style:${face.style};font-weight:${face.weight};font-display:swap;src:url("${url}") format("woff2");}`;
    })
    .join('');
}
