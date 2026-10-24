import { describe, expect, it } from 'vitest';
import { listUiFiles, readUiFile } from '../test/css';

const cssFiles = ['styles/components.css', 'styles/screens.css', 'styles/base.css', 'styles/surfaces.css', 'styles/shell.css'];
const css = (file: string) => readUiFile(file).replace(/\/\*[\s\S]*?\*\//g, '');

describe('design rules: grid, type and weights', () => {
  it('spacing tokens sit on the 4 px grid', () => {
    const tokens = readUiFile('styles/tokens.css');
    const spaces = [...tokens.matchAll(/--pn-space-\d+:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(spaces.length).toBeGreaterThanOrEqual(10);
    for (const px of spaces) expect(px % 4, `${px}px`).toBe(0);
  });

  it('spacing properties in component and screen CSS use tokens or multiples of 4 px (borders and focus rings may be 1 to 3 px)', () => {
    const property = /(^|[;{\s])(padding|margin|gap|row-gap|column-gap|inset|top|right|bottom|left|width|height|min-height|min-width|max-width)(-[a-z-]+)?:\s*([^;{}]+);/g;
    const offenders: string[] = [];
    for (const file of cssFiles) {
      for (const m of css(file).matchAll(property)) {
        const value = m[4]!;
        // calc() and max()/min() mix tokens with env(); only literal px lengths matter here.
        for (const px of value.matchAll(/(?<![\w.-])(-?\d+(?:\.\d+)?)px/g)) {
          const n = Math.abs(Number(px[1]));
          if (n % 4 === 0 || n === 0 || n <= 3) continue;
          // Component sizes that are deliberate (cover aspect, reading column) are allow-listed in the README.
          offenders.push(`${file}: ${m[2]}${m[3] ?? ''}: ${value.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('only two font families: Inter and Literata, always through the tokens', () => {
    const tokens = readUiFile('styles/tokens.css');
    expect(tokens).toMatch(/--pn-font-sans:\s*Inter,/);
    expect(tokens).toMatch(/--pn-font-serif:\s*Literata,/);
    for (const file of cssFiles) {
      for (const m of css(file).matchAll(/font-family:\s*([^;]+);/g)) {
        expect(m[1]!.trim(), `${file}: ${m[0]}`).toMatch(/^(var\(--pn-font-(sans|serif)\)|var\(--pn-reader-font, var\(--pn-font-serif\)\)|inherit)$/);
      }
    }
    const faces = [...readUiFile('styles/fonts.css').matchAll(/font-family:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(faces)).toEqual(new Set(['Inter', 'Literata']));
  });

  it('three text weights: 400, 600 and 700, always through the tokens', () => {
    const tokens = readUiFile('styles/tokens.css');
    const defined = [...tokens.matchAll(/--pn-weight-[a-z]+:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(new Set(defined)).toEqual(new Set([400, 600, 700]));
    for (const file of cssFiles) {
      for (const m of css(file).matchAll(/font-weight:\s*([^;]+);/g)) {
        expect(m[1]!.trim(), `${file}: ${m[0]}`).toMatch(/^(var\(--pn-weight-[a-z]+\)|inherit|normal)$/);
      }
    }
  });

  it('one icon set: icons come from the vendored Lucide nodes, with no other icon library or sprite', () => {
    const imports = listUiFiles()
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'))
      .map((f) => readUiFile(f))
      .join('\n');
    expect(imports).not.toMatch(/from '(lucide-react|react-icons|@heroicons|@radix-ui\/react-icons|@fortawesome)/);
    expect(readUiFile('icons/LICENSE-lucide.txt')).toContain('ISC License');
  });

  it('one accent per theme: a single --pn-accent, with soft and ink derived for the same hue', () => {
    const tokens = readUiFile('styles/tokens.css');
    for (const theme of ['light', 'sepia', 'dark', 'black']) {
      const block = tokens.slice(tokens.indexOf(`[data-theme="${theme}"]`));
      const body = block.slice(0, block.indexOf('}'));
      expect(body.match(/--pn-accent:/g), theme).toHaveLength(1);
    }
  });
});

describe('font budget', () => {
  it('the three font files total under 110 kB and no latin-ext file ships', () => {
    const fonts = listUiFiles().filter((f) => f.startsWith('fonts/') && f.endsWith('.woff2'));
    expect(fonts.sort()).toEqual([
      'fonts/inter-latin-wght-normal.woff2',
      'fonts/literata-latin-wght-italic.woff2',
      'fonts/literata-latin-wght-normal.woff2',
    ]);
  });
});

describe('sample data stays out of production', () => {
  const productionFiles = () =>
    listUiFiles().filter((f) => /\.(ts|tsx|css)$/.test(f) && !f.startsWith('demo/') && !f.startsWith('test/') && !/\.test\.tsx?$/.test(f));

  it('nothing in src/ui outside demo/ and test files imports the demo or the sample data', () => {
    for (const file of productionFiles()) {
      expect(readUiFile(file), file).not.toMatch(/demo\/|sample-data|ScreenGallery|UiKitDemo/);
    }
  });

  it('the public entry never exports the demo, the gallery or sample data', () => {
    const exportLines = readUiFile('index.ts')
      .split('\n')
      .filter((l) => /^\s*(export|\} from)/.test(l) || l.includes("from '"))
      .join('\n');
    expect(exportLines).not.toMatch(/demo|gallery|sample/i);
  });

  it('the gallery entry refuses to run outside development', () => {
    expect(readUiFile('demo/gallery-main.tsx')).toContain('import.meta.env.DEV');
  });
});
