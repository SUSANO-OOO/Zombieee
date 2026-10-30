import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {qualityCardOverlay} from './quality-card-overlay.mjs';

const root = path.resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for(const {kind, sourceName, masterHash, rightGutter=0, masterFile=null, sheet=true} of [
  {kind:'zakimiya',sourceName:'zakimiya-canonical-expressions-r1.png',masterHash:'78405e4610f6d8d71c0e094bcf2cf125522ca9b869db2146e39b9e6122ba88d7',rightGutter:36},
  {kind:'tky',sourceName:'tky-89-warm-r1.png',masterHash:'b49532ac389340e952707d6f102933c3f7b716aa6743ba0778be3b313377325e',masterFile:'assets/source/quality-20261028/identity/tky-89-warm-r1.png',sheet:false},
  {kind:'paisen',sourceName:'paisen-photo-master-r7.png',masterHash:'c769eb81a096e9fb1747df0c4ab93452b2ad844fb37e21707d5ef51aec76de66',masterFile:'assets/source/quality-20261028/identity/paisen-photo-master-r7.png',sheet:false},
]) {
const sourcePath = `assets/source/quality-20261028/identity/${sourceName}`;
const masterPath = masterFile ?? `assets/source/v090/characters/${kind}-identity-master-r1.png`;
assert.equal(sha(await readFile(path.join(root, masterPath))), masterHash, 'Canonical identity master changed');
const source = await readFile(path.join(root, sourcePath));
const {width, height, hasAlpha} = await sharp(source).metadata();
assert.ok(hasAlpha && (!sheet || width % 2 === 0 && height % 2 === 0), 'Expected transparent expression source');
const expressions = ['warm', 'determined', 'alarm', 'grief'];
const outputs = [];
const additionalSources = [];
async function save(relative, bytes) {
  if (check) assert.deepEqual(await readFile(path.join(root, relative)), bytes, relative);
  else await writeFile(path.join(root, relative), bytes);
  outputs.push({path: relative, sha256: sha(bytes), bytes: bytes.length});
}
for (const [index, expression] of expressions.entries()) {
  // Packing only. The same transform for all expressions preserves face/body scale.
  // The right cells contain a narrow strip of the left portrait's sleeve.
  // Remove only that packing spill, keeping the subject's original coordinates.
  const gutter = index % 2 ? rightGutter : 0;
  const overridePath = kind==='paisen' ? (expression==='warm' ? sourcePath : `assets/source/quality-20261028/identity/paisen-${expression}-r7.png`)
    : kind==='tky' ? `assets/source/quality-20261028/identity/tky-89-${expression}-r1.png` : null;
  const isolated = overridePath ? await readFile(path.join(root,overridePath)) : await sharp(source).extract({left: index % 2 * width / 2 + gutter,
    top: Math.floor(index / 2) * height / 2, width: width / 2 - gutter, height: height / 2})
    .extend({left:gutter,right:0,top:0,bottom:0,background:'#00000000'}).png().toBuffer();
  if(overridePath) additionalSources.push({expression,path:overridePath,sha256:sha(isolated)});
  // Paisen's independent originals include the upper thighs. Pack the same
  // waist-level crop for all four expressions without changing face pixels.
  const framed=kind==='paisen' ? await sharp(isolated).extract({left:0,top:0,width:1024,height:1344}).png().toBuffer() : isolated;
  const size=kind==='paisen'?{width:452,height:594}:{width:400,height:600};
  const cell = await sharp(framed)
    .resize({...size, fit: 'contain', background: '#00000000'}).png().toBuffer();
  const portrait = await sharp({create: {width: 512, height: 640, channels: 4, background: '#00000000'}})
    .composite([{input: cell, left: kind==='paisen'?30:56, top: kind==='paisen'?24:20}]).png().toBuffer();
  await save(`public/art/v100/portraits/${kind}-${expression}-quality-r1.webp`,
    await sharp(portrait).webp({quality: 92, alphaQuality: 100, effort: 6}).toBuffer());
  if (expression === 'warm') await save(`public/art/v100/portraits/${kind}-formation-card-quality-r1.webp`,
    await sharp(portrait).extract({left: 0, top: 0, width: 512, height: 512})
      .composite([{input: qualityCardOverlay(kind)}])
      .webp({quality: 92, alphaQuality: 100, effort: 6}).toBuffer());
}
const report = {generator: 'scripts/build-quality-canonical-portraits.mjs',
  master: {path: masterPath, sha256: masterHash}, source: {path: sourcePath, sha256: sha(source), width, height},
  masterRole: kind==='paisen' ? 'Directly generated from recovered original three photographs; see paisen-photo-r7-generation.json. Supersedes rejected r5/r6 candidates.'
    : kind==='tky' ? 'Producer-approved photo identity with smarter face, Korean actor styling and forehead fox half-mask incorporating89; see tky-89-r1-generation.json' : 'Approved identity and costume',
  expressions, additionalSources, outputs,
  runtimeAssetCount: outputs.length,
  logicalBytes: outputs.reduce((sum, output) => sum + output.bytes, 0),
  distinctBytes: [...new Map(outputs.map(output => [output.sha256, output.bytes])).values()].reduce((sum, bytes) => sum + bytes, 0),
  scope: 'Dialogue expressions and formation/personnel cards. Battle and scene paintings require separate verification.',
  acceptance: 'Canonical identity reference restored; not a numeric likeness score or Producer acceptance.'};
const reportPath = path.join(root, `assets/source/quality-20261028/identity/${kind}-runtime-provenance.json`);
const reportBytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
if (check) assert.deepEqual(await readFile(reportPath), reportBytes);
else await writeFile(reportPath, reportBytes);
console.log(JSON.stringify({kind, check, outputs: outputs.length, bytes: outputs.reduce((n, x) => n + x.bytes, 0)}));
}
