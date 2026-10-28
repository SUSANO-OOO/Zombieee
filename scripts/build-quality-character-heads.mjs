import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
import {V177_MELEE_JOINT_ATLASES} from '../app/v177MeleeJointData.js';
import {V177_FIREARM_JOINT_ATLASES} from '../app/v177FirearmJointData.js';
import {V177_PAISEN_PHOTO_JOINT_ATLASES} from '../app/v177PaisenPhotoJointData.js';
import {V177_NEWCOMER_JOINT_ATLASES} from '../app/v177NewcomerJointData.js';

const check=process.argv.includes('--check');
const hash=b=>createHash('sha256').update(b).digest('hex');
const output='assets/source/quality-20261028/identity';
const entries=[];
await mkdir('output/quality-20261028/head-adoption',{recursive:true});
async function emit(file,bytes){if(check)assert.deepEqual(await readFile(file),bytes,file);else await writeFile(file,bytes);}
for(const [kind,atlas] of [['kumaverson',V177_MELEE_JOINT_ATLASES.kumaverson],['babayaga',V177_FIREARM_JOINT_ATLASES.babayaga],['brawler',V177_PAISEN_PHOTO_JOINT_ATLASES.brawler],['tky',V177_NEWCOMER_JOINT_ATLASES.tky],['zakimiya',V177_NEWCOMER_JOINT_ATLASES.zakimiya]]) {
 const sourcePath=`${output}/${kind}-head-r1.png`,source=await readFile(sourcePath),base=await readFile('public'+atlas.path);
 const head=atlas.parts.find(p=>p.bone==='head');assert.ok(head);
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 // Find visible content for packing only. Preserve generated color and alpha.
 // Faint alpha < 8 outside the cutout must not inflate the packing rectangle.
 let x0=info.width,y0=info.height,x1=-1,y1=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=8){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 assert.ok(x1>x0&&y1>y0);
 const crop={left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};
 const tile=await sharp(source).extract(crop).resize(head.source.w,head.source.h,{fit:'contain',position:'bottom',background:'#00000000'}).png().toBuffer();
 const rawBase=await sharp(base).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const rawTile=await sharp(tile).ensureAlpha().raw().toBuffer();
 // Copy the packed rectangle directly: a whole-atlas source-over pass would
 // premultiply and round low-alpha pixels in unrelated original body tiles.
 for(let row=0;row<head.source.h;row++)rawTile.copy(rawBase.data,((head.source.y+row)*rawBase.info.width+head.source.x)*4,row*head.source.w*4,(row+1)*head.source.w*4);
 const bytes=await sharp(rawBase.data,{raw:rawBase.info}).webp({lossless:true,effort:6}).toBuffer();
 // Every non-head tile remains the original paint, including hands and shoes.
 for(const part of atlas.parts.filter(p=>p!==head)) {
  const r={left:part.source.x,top:part.source.y,width:part.source.w,height:part.source.h};
  const current=await sharp(bytes).extract(r).ensureAlpha().raw().toBuffer(),original=await sharp(base).extract(r).ensureAlpha().raw().toBuffer();
  for(let i=0;i<current.length;i+=4){
   assert.equal(current[i+3],original[i+3],`${kind}/${part.name} alpha changed`);
   if(original[i+3]>0)for(let channel=0;channel<3;channel++)assert.equal(current[i+channel],original[i+channel],`${kind}/${part.name} visible RGB changed`);
  }
 }
 const assetPath=`/art/v100/joints/${kind}-quality-head-r1.webp`;
 await emit('public'+assetPath,bytes);
 entries.push({kind,sourcePath,sourceSha256:hash(source),basePath:atlas.path,baseSha256:hash(base),crop,headSource:head.source,headDestination:head.destination,assetPath,bytes:bytes.length,sha256:hash(bytes),geometry:'Original pose matrices, neck attachment, tile rectangle and body paint retained; only head texture replaced.'});
 for(const [version,texture] of [['before',base],['after',bytes]]) {
  const layers=[];
  for(const part of atlas.parts){const r=part.source,d=part.destination;layers.push({input:await sharp(texture).extract({left:r.x,top:r.y,width:r.w,height:r.h}).resize(d.w,d.h).png().toBuffer(),left:d.x,top:d.y});}
  await sharp({create:{width:atlas.width,height:atlas.height,channels:4,background:'#29313a'}}).composite(layers).png().toFile(`output/quality-20261028/head-adoption/${kind}-${version}-rest.png`);
 }
}
await emit(`${output}/head-runtime-provenance.json`,Buffer.from(JSON.stringify({generator:'scripts/build-quality-character-heads.mjs',creator:'OpenAI built-in image_gen under Producer direction; deterministic atlas packing by this script',source:'Producer-provided photographs for brawler, tky, babayaga and kumaverson; project canonical v090 identity for zakimiya. Private photos are not copied into Git or public.',license:'Generated project derivative; no third-party stock license. Formal rights review remains open before final asset adoption.',permissions:{modification:'Producer requested',inGameRedistribution:'Producer requested playable game candidate',commercialUse:'Not separately reviewed in this change',referencePhotoRedistribution:false},producerApproval:'Creation and integration requested; final likeness and art acceptance remain open',runtimeAssetCount:entries.length,logicalBytes:entries.reduce((n,e)=>n+e.bytes,0),distinctBytes:entries.reduce((n,e)=>n+e.bytes,0),entries,scope:'Shared battle head texture candidate. Fallback raster sheets, scene paintings, credits and whole-cast acceptance remain open. Numeric likeness percentage not asserted.'},null,2)+'\n'));
console.log(JSON.stringify({check,heads:entries.length,bytes:entries.reduce((n,e)=>n+e.bytes,0)}));
