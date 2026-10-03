import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
const source='assets/source/v100/vfx/generated/muzzle-six-frames-r1.png';
const target='public/art/v100/combat-vfx/muzzle-six-frames-r1.webp';
const metadata=await sharp(source).metadata();
if(metadata.width!==1536||metadata.height!==1024)throw new Error('Expected six 512px square authored cells.');
await mkdir('public/art/v100/combat-vfx',{recursive:true});
// Lossless encoding preserves the authored color and fractional alpha.
await sharp(source).webp({lossless:true,effort:6}).toFile(target);
const record=async file=>{const data=await readFile(file);return{file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}};
const provenance={
 generator:'Built-in image_gen tool',
 generatedFile:'exec-aa3ed65f-5e5c-4889-9ea7-7fb2421f3a3b.png',
 prompt:'Create a six-frame muzzle flash sprite sheet, exactly three columns and two rows of 512x512 cells on a 1536x1024 pure black canvas, for additive light compositing. Realistic organic gunpowder flame, ignition, expansion, breakup, smoke and embers in chronological order. Fixed ignition anchor, pointing right. Wide black gutters. No gun, person, letters, geometric stars, triangles, rings or bars.',
 adaptation:'The returned source has real fractional alpha, which is preserved. No pixel editing or background removal. Lossless WebP encoding only. Runtime samples six authored cells, rotates at the firing point and expires in 85–140ms according to weapon.',
 source:await record(source),output:await record(target),
 geometry:{columns:3,rows:2,cellSize:512,observedIgnition:{x:112,y:246},composite:'lighter'},
 status:'Local visual candidate; actual combat and producer acceptance recorded separately.',
};
await writeFile('assets/source/v100/vfx/generated/muzzle-provenance-r1.json',JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify(provenance.output));
