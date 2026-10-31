/**
 * Renders the PNG icons and splash screens from the SVG sources in this folder, using the Chromium that
 * Playwright already installs for the e2e tests. Run from the repository root:
 *   node src/ui/assets/render-assets.mjs
 * Output goes to src/ui/assets/generated/. The fonts are the self-hosted Inter and Literata in ../fonts.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../package.json'));
const { chromium } = require('@playwright/test');
const out = resolve(here, 'generated');
mkdirSync(out, { recursive: true });

const fontCss = `
@font-face { font-family: Inter; font-weight: 400 700; src: url("${pathToFileURL(resolve(here, '../fonts/inter-latin-wght-normal.woff2'))}") format("woff2-variations"); }
@font-face { font-family: Literata; font-weight: 400 700; src: url("${pathToFileURL(resolve(here, '../fonts/literata-latin-wght-normal.woff2'))}") format("woff2-variations"); }`;

/** [source svg, output name, width, height, transparent background] */
const jobs = [
  ['icon.svg', 'icon-192.png', 192, 192, true],
  ['icon.svg', 'icon-512.png', 512, 512, true],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512, 512, false],
  ['icon-full-bleed.svg', 'apple-touch-icon-180.png', 180, 180, false],
  ['splash-light.svg', 'splash-light-1170x2532.png', 1170, 2532, false],
  ['splash-dark.svg', 'splash-dark-1170x2532.png', 1170, 2532, false],
  ['splash-light.svg', 'splash-light-1290x2796.png', 1290, 2796, false],
  ['splash-dark.svg', 'splash-dark-1290x2796.png', 1290, 2796, false],
];

const browser = await chromium.launch();
for (const [source, name, width, height, transparent] of jobs) {
  const svg = readFileSync(resolve(here, source), 'utf8').replace(/ width="\d+" height="\d+"/, ' width="100%" height="100%"');
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(`<style>${fontCss} html,body{margin:0;background:transparent} svg{display:block}</style>${svg}`);
  await page.evaluate(() => document.fonts.ready);
  // Splash art is 1170 x 2532; scale-to-fill keeps the mark centered on taller screens.
  if (source.startsWith('splash')) {
    await page.evaluate(() => {
      const el = document.querySelector('svg');
      el.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    });
  }
  writeFileSync(resolve(out, name), await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width, height } }));
  await page.close();
}
await browser.close();
console.log(`rendered ${jobs.length} files to ${out}`);
