import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const dir = '/workspace/work/sample/x/OEBPS';
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.jpg')) continue;
  const isCover = f.includes('cover');
  const buf = await sharp(path.join(dir, f)).resize({ width: isCover ? 400 : 360, withoutEnlargement: true }).jpeg({ quality: 52, mozjpeg: true }).toBuffer();
  fs.writeFileSync(path.join(dir, f), buf);
}
