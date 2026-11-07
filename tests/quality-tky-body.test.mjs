import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {QUALITY_TKY_COMBAT_ATLAS as atlas} from '../app/qualityTkyCombatJointData.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
const dir='assets/source/quality-20261028/rigs/tky-combat-r1';
const d=JSON.parse(await readFile(`${dir}/parts.json`));
const hash=b=>createHash('sha256').update(b).digest('hex');

test('TKY uses his own complete generated body and preserved source-bound hidden cloth',async()=>{
 assert.equal(V177_JOINT_ATLASES.tky,atlas);
 assert.equal(d.identityBinding.modelSource,'assets/source/quality-20261028/identity/tky-89-warm-r1.png');
 assert.equal(hash(await readFile(d.identityBinding.modelSource)),d.identityBinding.modelSha256);
 assert.equal(hash(await readFile(d.modelSource)),d.sourceSha256);
 assert.equal(hash(await readFile(d.sourceOperation.underpainting)),d.sourceOperation.underpaintingSha256);
 assert.equal(d.parts.length,atlas.parts.length);
 for(const part of d.parts){
  assert.equal(hash(await readFile(`${dir}/${part.file}`)),part.sha256,part.name);
  assert.ok(part.name==='weapon-and-hands'?part.source==='plasma-correction':['model','under','registeredBoot'].includes(part.source),'Only the weapon uses corrected paint; the body stays in its original family');
 }
 assert.deepEqual(d.parentAttachments.head.pivot,atlas.parentAttachments.head.pivot);
});

test('the plasma tip socket belongs to visible energy paint and distribution has one preferred body',async()=>{
 const weapon=d.parts.find(part=>part.name==='weapon-and-hands');
 const pixels=await sharp(`${dir}/${weapon.file}`).ensureAlpha().raw().toBuffer();
 const [x,y]=atlas.muzzle.map(Math.floor);
 assert.ok(pixels[(y*480+x)*4+3]>=200,'Contact must be on the visible blade tip');
 const manifest=JSON.parse(await readFile('public/asset-manifest.json'));
 const rows=manifest.assets.filter(a=>a.path===atlas.path);assert.equal(rows.length,1);
 const bytes=await readFile('public'+atlas.path);
 assert.equal(rows[0].bytes,bytes.length);assert.equal(rows[0].hash,'sha256-'+hash(bytes));
 assert.ok(!manifest.assets.some(a=>a.path==='/art/v100/joints/tky-quality-neck-r4.webp'),'retired head-only texture is not downloaded alongside current body');
 assert.ok(!manifest.assets.some(a=>a.path==='/art/v100/joints/tky-combat-r1.webp'),'the replaced metal-blade body is not in the current download');
 assert.ok(atlas.decodedBytes<=512*1024);
});

test('the corrected blade has a bright core and pink light along its length; the former metal blade fails this contract',async()=>{
 async function luminousBlade(file){
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  return [[310,162],[360,120],[410,79]].every(([x,y])=>{
   const at=(xx,yy)=>data.subarray((yy*info.width+xx)*4,(yy*info.width+xx)*4+4);
   const core=at(x,y);let pink=0;
   for(let yy=y-5;yy<=y+5;yy++)for(let xx=x-5;xx<=x+5;xx++){
    const [r,g,b,a]=at(xx,yy);if(a>=128&&r>=180&&b>=140&&g<190)pink++;
   }
   return core[3]>=200&&Math.min(core[0],core[1],core[2])>=230&&pink>=8;
  });
 }
 const weapon=d.parts.find(part=>part.name==='weapon-and-hands');
 assert.equal(await luminousBlade(`${dir}/${weapon.file}`),true);
 assert.equal(await luminousBlade(`${dir}/weapon-and-hands.png`),false);
});

test('the weapon correction preserves the adopted body paint, identity attachments and all existing motion',async()=>{
 const correction=JSON.parse(await readFile('assets/source/quality-20261107/tky-plasma-r1/generation.json'));
 for(const part of d.parts.filter(part=>part.name!=='weapon-and-hands'))assert.equal(part.sha256,correction.preservedContract.bodyParts[part.name],part.name);
 for(const [key,expected]of Object.entries(correction.preservedContract.atlasFields))assert.equal(hash(JSON.stringify(atlas[key])),expected,key);
});
