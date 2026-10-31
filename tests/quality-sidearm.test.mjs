import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {QUALITY_CHARACTER_BASE_ATLASES,QUALITY_CHARACTER_HEAD_ATLASES,QUALITY_CHARACTER_ATLASES} from '../app/qualityCharacterAtlases.js';
import {QUALITY_SIDEARM_PATH,QUALITY_SIDEARM_BASE_PATH,QUALITY_SIDEARM_RETAINED_BASE} from '../app/qualitySidearmAtlas.js';
import {qualityHeadOnlyOverride} from '../scripts/quality-head-only-override.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function assertRetainedPaint(original,current){
 for(let y=0;y<original.info.height;y++)for(let x=0;x<original.info.width;x++){
  const a=(y*original.info.width+x)*4,b=(y*current.info.width+x)*4;assert.equal(current.data[b+3],original.data[a+3]);
  if(original.data[a+3])assert.deepEqual(current.data.subarray(b,b+3),original.data.subarray(a,a+3));
 }
}
test('Baba final atlas retains the selected face, every non-weapon part, joints and all action poses',async()=>{
 const before=QUALITY_CHARACTER_HEAD_ATLASES.babayaga,after=QUALITY_CHARACTER_ATLASES.babayaga;
 const part=after.parts.find(p=>p.bone===after.weaponBone);
 assert.deepEqual({...after,path:before.path,decodedWidth:before.decodedWidth,decodedHeight:before.decodedHeight,decodedBytes:before.decodedBytes,parts:before.parts},before);
 assert.deepEqual(after.parts.filter(p=>p.bone!==after.weaponBone),before.parts.filter(p=>p.bone!==before.weaponBone));
 const original=await sharp(QUALITY_SIDEARM_RETAINED_BASE).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const current=await sharp('public'+QUALITY_SIDEARM_PATH).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assertRetainedPaint(original,current);
 const sx=part.source.x+(after.muzzle[0]-part.destination.x)/part.destination.w*part.source.w;
 const sy=part.source.y+(after.muzzle[1]-part.destination.y)/part.destination.h*part.source.h;
 assert.ok(current.data[(Math.floor(sy)*current.info.width+Math.floor(sx))*4+3]>=128,'measured muzzle remains on the new barrel');
 const oldWeapon=before.parts.find(p=>p.bone===before.weaponBone),crop=(raw,p)=>sharp(raw.data,{raw:raw.info}).extract({left:p.source.x,top:p.source.y,width:p.source.w,height:p.source.h}).resize(102,46).raw().toBuffer();
 assert.notDeepEqual(await crop(current,part),await crop(original,oldWeapon),'weapon paint actually changes');
 for(const kind of Object.keys(QUALITY_CHARACTER_ATLASES).filter(k=>k!=='babayaga'))assert.strictEqual(QUALITY_CHARACTER_ATLASES[kind],QUALITY_CHARACTER_HEAD_ATLASES[kind]);
});
test('The final-paint preservation guard rejects a changed face pixel and alpha, including otherwise valid sidearm data',async()=>{
 const before=await sharp(QUALITY_SIDEARM_RETAINED_BASE).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const after=await sharp('public'+QUALITY_SIDEARM_PATH).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const head=QUALITY_CHARACTER_HEAD_ATLASES.babayaga.parts.find(p=>p.bone==='head').source;
 let i=-1;for(let y=head.y;y<head.y+head.h&&i<0;y++)for(let x=head.x;x<head.x+head.w;x++)if(before.data[(y*before.info.width+x)*4+3]>128){i=(y*before.info.width+x)*4;break;}
 assert.ok(i>=0);const altered={...after,data:Buffer.from(after.data)};altered.data[i]=(altered.data[i]+1)%256;
 assert.throws(()=>assertRetainedPaint(before,altered));altered.data.set(after.data.subarray(i,i+4),i);altered.data[i+3]=0;
 assert.throws(()=>assertRetainedPaint(before,altered));assertRetainedPaint(before,after);
});
test('The sole preferred sidearm runtime derives from the adopted model, with the old version retained outside public',async()=>{
 const p=JSON.parse(await readFile('assets/source/quality-20261028/weapon-sidearm-r1/runtime-provenance.json')),entry=p.entries[0];
 assert.equal(entry.model,'assets/source/quality-20261028/identity/babayaga-master-r1.png');assert.equal(hash(await readFile(entry.model)),entry.modelSha256);
 assert.equal(hash(await readFile(QUALITY_SIDEARM_RETAINED_BASE)),entry.baseSha256);assert.equal(hash(await readFile('public'+QUALITY_SIDEARM_PATH)),entry.sha256);
 assert.equal(entry.assetPath,QUALITY_SIDEARM_PATH);assert.equal(entry.basePath,QUALITY_SIDEARM_BASE_PATH);
 const manifest=JSON.parse(await readFile('public/asset-manifest.json'));assert.equal(manifest.assets.filter(a=>a.path===QUALITY_SIDEARM_PATH).length,1);assert.equal(manifest.assets.filter(a=>a.path===QUALITY_SIDEARM_BASE_PATH).length,0);
 await assert.rejects(readFile('public'+QUALITY_SIDEARM_BASE_PATH),{code:'ENOENT'});
});
test('Head-only comparison preserves the later handgun and rejects out-of-bound source rectangles',async()=>{
 const current=await readFile('public'+QUALITY_SIDEARM_PATH),before=await readFile('public'+QUALITY_CHARACTER_BASE_ATLASES.babayaga.path);
 const head=QUALITY_CHARACTER_HEAD_ATLASES.babayaga.parts.find(p=>p.bone==='head').source;
 const packed=await qualityHeadOnlyOverride(current,before,head),a=await sharp(current).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(packed).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(a.info.width,b.info.width);assert.equal(a.info.height,b.info.height);
 let changed=0;for(let y=0;y<a.info.height;y++)for(let x=0;x<a.info.width;x++){
  const i=(y*a.info.width+x)*4;if(x>=head.x&&x<head.x+head.w&&y>=head.y&&y<head.y+head.h){if(!a.data.subarray(i,i+4).equals(b.data.subarray(i,i+4)))changed++;continue;}
  assert.equal(a.data[i+3],b.data[i+3]);if(a.data[i+3])assert.deepEqual(a.data.subarray(i,i+3),b.data.subarray(i,i+3));
 }
 assert.ok(changed>10,'the comparison really restores a previous head');
 await assert.rejects(qualityHeadOnlyOverride(current,before,{...head,y:10000}),/outside/);
 await assert.rejects(qualityHeadOnlyOverride(current,before,{...head,x:-1}));
});
