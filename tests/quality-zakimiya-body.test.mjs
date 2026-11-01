import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {QUALITY_ZAKIMIYA_COMBAT_ATLAS as atlas} from '../app/qualityZakimiyaCombatJointData.js';
import {V177_JOINT_ATLASES,v177JointPose,v177CaptureJointPose} from '../app/v177JointPresentation.js';
const dir='assets/source/quality-20261028/rigs/zakimiya-combat-r1';
const d=JSON.parse(await readFile(`${dir}/parts.json`));
const hash=b=>createHash('sha256').update(b).digest('hex');

test('ZAKIMIYA uses his own complete generated body and preserved source-bound hidden cloth',async()=>{
 assert.equal(V177_JOINT_ATLASES.zakimiya,atlas);
 assert.equal(d.identityBinding.modelSource,'assets/source/quality-20261028/identity/zakimiya-canonical-master-r1.png');
 assert.equal(hash(await readFile(d.identityBinding.modelSource)),d.identityBinding.modelSha256);
 assert.equal(hash(await readFile(d.modelSource)),d.sourceSha256);
 assert.equal(hash(await readFile(d.sourceOperation.underpainting)),d.sourceOperation.underpaintingSha256);
 assert.equal(d.parts.length,atlas.parts.length);
 for(const part of d.parts){
  assert.equal(hash(await readFile(`${dir}/${part.file}`)),part.sha256,part.name);
  assert.ok(['model','under'].includes(part.source),'Every part is from this full-body family, not a retained cartoon body');
 }
 assert.deepEqual(d.parentAttachments.head.pivot,atlas.parentAttachments.head.pivot);
});

test('the actual bottle contact socket belongs to opaque weapon paint and current distribution has one preferred body',async()=>{
 const pixels=await sharp(`${dir}/weapon-and-hands.png`).ensureAlpha().raw().toBuffer();
 const [x,y]=atlas.muzzle.map(Math.floor);
 assert.ok(pixels[(y*480+x)*4+3]>=200,'Contact must be on the visible bottle base');
 const manifest=JSON.parse(await readFile('public/asset-manifest.json'));
 const rows=manifest.assets.filter(a=>a.path===atlas.path);assert.equal(rows.length,1);
 const bytes=await readFile('public'+atlas.path);
 assert.equal(rows[0].bytes,bytes.length);assert.equal(rows[0].hash,'sha256-'+hash(bytes));
 assert.ok(!manifest.assets.some(a=>a.path==='/art/v100/joints/zakimiya-quality-neck-r4.webp'),'retired head-only texture is not downloaded alongside current body');
 assert.ok(atlas.decodedBytes<=512*1024);
});

test('Zakimiya holds one bottle and keeps the empty hand independent',()=>{
 assert.deepEqual(d.armConstraints.map(c=>c.effectorBone),['weapon-0','arm-1-hand']);
 assert.equal(d.rig.weapons.length,1);
 assert.equal(d.rig.firearm,false);
 assert.equal(d.parts.filter(p=>p.bone==='weapon-0').length,1);
 assert.equal(d.parts.find(p=>p.name==='free-hand').bone,'arm-1-hand');
});

test('stopped and attacking Zakimiya supports both hips without reversing the resting feet',()=>{
 const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
 for(const state of ['idle','wind-up','active','recovery'])for(const phase of [0,.25,.5,.75,1]){
  const plan=v177JointPose('zakimiya',{requestedState:state,clipProgress:phase},{locomotionPhase:.137,locomotionSettle:1});
  const pose=v177CaptureJointPose('zakimiya',plan);
  const hips=d.rig.legs.map(l=>point(pose.lower.pelvis,l.hip));
  const feet=d.rig.legs.map((l,i)=>point(pose.lower[`leg-${i}-foot`],l.ankle));
  assert.ok((hips[0][0]-hips[1][0])*(feet[0][0]-feet[1][0])>0,state+': resting legs must not swap sides');
 }
});
