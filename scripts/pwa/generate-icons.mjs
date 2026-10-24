// Generates every PWA icon from the three SVG sources in scripts/pwa/icons/.
// Usage: node scripts/pwa/generate-icons.mjs   (run from the repo root; needs the `sharp` dev dependency)
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (name) => join(root, 'scripts', 'pwa', 'icons', name);
const out = (name) => join(root, 'public', name);

const png = async (svgName, size, outName) => {
  const svg = await readFile(src(svgName));
  await sharp(svg, { density: (72 * size) / 512 * 4 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out(outName));
};

// An .ico may embed PNG images (Vista+). One 32x32 and one 48x48 image.
const ico = async (svgName, outName) => {
  const sizes = [32, 48];
  const images = await Promise.all(
    sizes.map(async (s) =>
      sharp(await readFile(src(svgName)), { density: 288 }).resize(s, s).png().toBuffer(),
    ),
  );
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map((img, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(sizes[i], 0); // width
    e.writeUInt8(sizes[i], 1); // height
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(img.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += img.length;
    return e;
  });
  await writeFile(out(outName), Buffer.concat([header, ...entries, ...images]));
};

await mkdir(join(root, 'public', 'icons'), { recursive: true });
await png('any.svg', 192, 'icons/icon-192.png');
await png('any.svg', 512, 'icons/icon-512.png');
await png('maskable.svg', 512, 'icons/maskable-512.png');
await png('full.svg', 180, 'apple-touch-icon.png');
await copyFile(src('any.svg'), out('favicon.svg'));
await ico('any.svg', 'favicon.ico');
console.log('icons written to public/');
