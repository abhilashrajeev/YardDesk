import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(dir, '..', 'public');

const any = readFileSync(path.join(pub, 'icon-source.svg'));
const maskable = readFileSync(path.join(pub, 'icon-maskable-source.svg'));

async function gen(svg, outName, size) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(path.join(pub, outName));
  console.log('wrote', outName);
}

await gen(any, 'icon-192.png', 192);
await gen(any, 'icon-512.png', 512);
await gen(any, 'apple-touch-icon.png', 180);
await gen(maskable, 'icon-maskable-512.png', 512);
await gen(maskable, 'icon-maskable-192.png', 192);
await gen(any, 'favicon.png', 64);
