import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {QUALITY_CHARACTER_HEAD_ATLASES,QUALITY_CHARACTER_ATLASES} from '../app/qualityCharacterAtlases.js';
import {QUALITY_SIDEARM_RETAINED_BASE,QUALITY_SIDEARM_PATH} from '../app/qualitySidearmAtlas.js';
const root='assets/source/quality-20261028/weapon-sidearm-r1';
const check=process.argv.includes('--check'),sha=b=>createHash('sha256').update(b).digest('hex');
const p=JSON.parse(await readFile(root+'/source-plan.json'));
assert.equal(sha(await readFile(p.model)),p.modelSha256,'adopted model unchanged');
const base=await readFile(QUALITY_SIDEARM_RETAINED_BASE);assert.equal(sha(base),p.baseAtlasSha256);
const a=QUALITY_CHARACTER_HEAD_ATLASES.babayaga,b=QUALITY_CHARACTER_ATLASES.babayaga;
const raw=await sharp(base).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(raw.info.width,512);assert.equal(raw.info.height,65);
const authored=await readFile(root+'/'+p.authored),part=await sharp(authored).ensureAlpha().raw().toBuffer({resolveWithObject:true});
assert.equal(part.info.width,212);assert.equal(part.info.height,102);
const weapon=b.parts.find(part=>part.bone===b.weaponBone);
const px=Math.floor((a.muzzle[0]-weapon.destination.x)*p.density),py=Math.floor((a.muzzle[1]-weapon.destination.y)*p.density);
assert.ok(part.data[(py*part.info.width+px)*4+3]>=128,'original muzzle lands on the extracted barrel');
// Copy raw rows: alpha compositing would round semitransparent body RGB even
// against an empty background. The retained face/body paint must stay exact.
const pixels=Buffer.alloc(b.decodedBytes);
for(let y=0;y<raw.info.height;y++)raw.data.copy(pixels,y*b.decodedWidth*4,y*raw.info.width*4,(y+1)*raw.info.width*4);
for(let y=0;y<part.info.height;y++)part.data.copy(pixels,((weapon.source.y+y)*b.decodedWidth+weapon.source.x)*4,y*part.info.width*4,(y+1)*part.info.width*4);
const packed=await sharp(pixels,{raw:{width:b.decodedWidth,height:b.decodedHeight,channels:4}}).webp({lossless:true,effort:6}).toBuffer();
const actual=await sharp(packed).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(actual.data.length,b.decodedBytes);
for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++){
 const i=(y*raw.info.width+x)*4,j=(y*actual.info.width+x)*4;assert.equal(actual.data[j+3],raw.data[i+3]);
 if(raw.data[i+3])assert.deepEqual(actual.data.subarray(j,j+3),raw.data.subarray(i,i+3),'base visible paint remains exact');
}
assert.deepEqual(b.armConstraints,a.armConstraints);assert.deepEqual(b.poses,a.poses);assert.deepEqual(b.muzzle,a.muzzle);
const entry={kind:'babayaga',basePath:p.baseAtlas,retainedBase:QUALITY_SIDEARM_RETAINED_BASE,baseSha256:p.baseAtlasSha256,
 assetPath:QUALITY_SIDEARM_PATH,bytes:packed.length,sha256:sha(packed),model:p.model,modelSha256:p.modelSha256,
 authored:root+'/'+p.authored,authoredSha256:sha(authored),source:weapon.source,destination:weapon.destination,
 decodedBytes:b.decodedBytes,muzzle:b.muzzle,wristPoints:b.armConstraints.map(c=>c.effectorWrist)};
const provenance={generator:'scripts/build-quality-sidearm.mjs',operation:'Mechanical extraction of the handgun already present in the adopted Baba model; the original hand region is reused with both wrist anchors fixed. All non-weapon body/head paint is retained exactly. No newly generated firearm image.',
 creator:'Existing Producer-selected OpenAI model; deterministic project component registration and packing',
 license:'Same project-generated source rights as the adopted model. No third-party asset, new purchase or contract.',
 privatePhotosIncluded:false,preferredRuntime:QUALITY_SIDEARM_PATH,retiredRuntime:p.baseAtlas,retainedBase:QUALITY_SIDEARM_RETAINED_BASE,
 acceptance:'Technical/source checks only; full-size game comparison and final appearance acceptance remain separate.',entries:[entry]};
async function emit(file,bytes){if(check)assert.deepEqual(await readFile(file),bytes,file);else await writeFile(file,bytes);}
await emit('public'+QUALITY_SIDEARM_PATH,packed);await emit(root+'/runtime-provenance.json',Buffer.from(JSON.stringify(provenance,null,2)+'\n'));
console.log(JSON.stringify({check,path:QUALITY_SIDEARM_PATH,bytes:packed.length,decodedBytes:b.decodedBytes}));
