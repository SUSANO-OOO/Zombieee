import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {qualityCardOverlay} from './quality-card-overlay.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sourceDir = path.join(root, 'assets/source/quality-20261028/identity');
const outputDir = path.join(root, 'public/art/v100/portraits');
const check = process.argv.includes('--check');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const expressions = ['warm', 'determined', 'alarm', 'grief'];
const sources = [], outputs = [];
await mkdir(outputDir, {recursive:true});
async function save(name, bytes) {
  const file = path.join(outputDir, name);
  if (check) assert.deepEqual(await readFile(file), bytes, `${name} differs from its source`);
  else await writeFile(file, bytes);
  const {width,height,hasAlpha} = await sharp(bytes).metadata();
  outputs.push({path:'/art/v100/portraits/'+name,bytes:bytes.length,sha256:hash(bytes),width,height,hasAlpha});
}
for (const kind of ['babayaga','kumaverson']) {
  const sourcePath = `assets/source/quality-20261028/identity/${kind}-expressions-r2.png`;
  const source = await readFile(path.join(root,sourcePath));
  const metadata = await sharp(source).metadata();
  assert.ok(metadata.hasAlpha, `${kind} must preserve real alpha`);
  const cellWidth = Math.floor(metadata.width/2), cellHeight = Math.floor(metadata.height/2);
  // Packing only: retain the generated pixels/alpha, no face recoloring or repaint.
  // The wide Kuma bust is framed as a portrait without stretching his face.
  const crop = kind==='kumaverson'
    ? {left:88,top:0,width:480,height:cellHeight}
    : {left:0,top:0,width:cellWidth,height:cellHeight-14};
  sources.push({path:sourcePath,sha256:hash(source),width:metadata.width,height:metadata.height,crop});
  let warm;
  for (const [index,expression] of expressions.entries()) {
    const cell = await sharp(source).extract({left:(index%2)*cellWidth,top:Math.floor(index/2)*Math.ceil(metadata.height/2),width:cellWidth,height:cellHeight}).png().toBuffer();
    const framed = await sharp(cell).extract(crop).resize({width:500,height:624,fit:'inside'}).png().toBuffer();
    const {width} = await sharp(framed).metadata();
    const portrait = await sharp({create:{width:512,height:640,channels:4,background:'#00000000'}})
      .composite([{input:framed,left:Math.floor((512-width)/2),top:16}]).png().toBuffer();
    await save(`${kind}-${expression}-r3.webp`,await sharp(portrait).webp({quality:92,alphaQuality:100,effort:6}).toBuffer());
    if(expression==='warm') warm=portrait;
  }
  const card = await sharp(warm).extract({left:0,top:0,width:512,height:512})
    .composite([{input:qualityCardOverlay(kind)}]).webp({quality:92,alphaQuality:100,effort:6}).toBuffer();
  await save(`${kind}-formation-card-r3.webp`,card);
  // Preserve the phone WebKit lossless PNG transport contract for Kuma.
  if(kind==='kumaverson') await save(`${kind}-formation-card-r3.png`,await sharp(card).png().toBuffer());
}
const report={generator:'scripts/build-quality-identity-portraits.mjs',sources,outputs,
  scope:'Cards, identity portraits and all four dialogue expressions. Battle rigs, scene paintings and staff-roll paintings remain a separate uncompleted task.',
  likeness:'Producer photo identity is the artistic reference; no numeric similarity score measured.',
  alphaReview:'Review after normal source-over alpha composition; low-alpha RGB is not opaque fringe.'};
const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');
const reportFile=path.join(sourceDir,'portrait-runtime-provenance.json');
if(check) assert.deepEqual(await readFile(reportFile),bytes);else await writeFile(reportFile,bytes);
console.log(JSON.stringify({check,outputs:outputs.length,bytes:outputs.reduce((n,r)=>n+r.bytes,0)}));
