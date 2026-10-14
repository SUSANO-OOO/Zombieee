import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const sourceDir = path.join(root, 'assets/source/v177/paisen');
const publicDir = path.join(root, 'public/art/v100/portraits');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const source = await readFile(path.join(sourceDir, 'paisen-identity-r2.png'));
const metadata = await sharp(source).metadata();
assert.equal(metadata.width, 1024);
assert.equal(metadata.height, 1536);
assert.ok(metadata.hasAlpha, 'The producer-reference master must retain real alpha');
await mkdir(publicDir, {recursive: true});

const outputs = [];
async function save(name, pipeline) {
  const bytes = await pipeline.webp({lossless: true, effort: 6}).toBuffer();
  await writeFile(path.join(publicDir, name), bytes);
  const {width, height, hasAlpha} = await sharp(bytes).metadata();
  outputs.push({path: '/art/v100/portraits/' + name, bytes: bytes.length, sha256: digest(bytes), width, height, hasAlpha});
}

async function framePortrait(bytes) {
  // Keep the painted proportions and restore the required phone head margin.
  const inset = await sharp(bytes).resize({width: 500, height: 624, fit: 'inside'}).png().toBuffer();
  const {width} = await sharp(inset).metadata();
  return sharp({create: {width: 512, height: 640, channels: 4, background: '#00000000'}})
    .composite([{input: inset, left: Math.floor((512 - width) / 2), top: 16}])
    .png().toBuffer();
}

await save('paisen-identity-r2.webp', sharp(source));
// One crop of the identity master keeps the neutral portrait's actual face.
const portrait = await framePortrait(await sharp(source)
  .extract({left: 180, top: 0, width: 680, height: 850})
  .resize(512, 640)
  .png().toBuffer());
await save('paisen-event-portrait-r2.webp', sharp(portrait));

const badge = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect x="16" y="16" width="10" height="480" rx="5" fill="#f0a34a"/>
  <path d="M300 340h196v156H276l24-156z" fill="#090d12" fill-opacity=".88" stroke="#f0a34a" stroke-width="5"/>
  <g transform="translate(310 350) scale(.9)" fill="none" stroke="#f0a34a" stroke-width="10" stroke-linejoin="round"><path d="M33 78v-26l13-14 17 4 11 17-5 30-20 11-16-22zm50-7v-22l15-11 16 7 4 27-14 23-18-8-3-16z"/></g>
  <text x="474" y="480" text-anchor="end" font-family="Arial,sans-serif" font-weight="900" font-size="28" letter-spacing="2" fill="#fff">FIST</text>
</svg>`);
await save('paisen-formation-card-r3.webp', sharp(portrait)
  .extract({left: 45, top: 0, width: 420, height: 420})
  .resize(512, 512).composite([{input: badge}]));

// --base-only prepares the exact edit target before expression generation.
if (!process.argv.includes('--base-only')) {
  for (const expression of ['warm', 'determined', 'alarm', 'grief']) {
    const bytes = await readFile(path.join(sourceDir, 'paisen-' + expression + '-r2.png'));
    const meta = await sharp(bytes).metadata();
    assert.ok(meta.hasAlpha, expression + ' must retain the transparent portrait');
    // The built-in editor can round a requested 4:5 canvas by one pixel.
    // Crop at most two border pixels; never stretch a different composition.
    assert.ok(Math.abs(meta.width - meta.height * 4 / 5) <= 2, expression + ' must keep the original portrait aspect ratio');
    const unit = Math.floor(Math.min(meta.width / 4, meta.height / 5));
    const width = unit * 4, height = unit * 5;
    assert.ok(meta.width - width <= 3 && meta.height - height <= 4);
    const framed = await framePortrait(await sharp(bytes)
      .extract({left: Math.floor((meta.width - width) / 2), top: Math.floor((meta.height - height) / 2), width, height})
      .resize(512, 640).png().toBuffer());
    await save('paisen-' + expression + '-r2.webp', sharp(framed));
  }
}
const report = {generator: 'scripts/build-v177-paisen-identity.mjs', source: {path: 'assets/source/v177/paisen/paisen-identity-r2.png', sha256: digest(source)}, outputs};
await writeFile(path.join(sourceDir, 'runtime-provenance.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
