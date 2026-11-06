import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {QUALITY_MUSASHI_COMBAT_ATLAS as atlas} from '../app/qualityMusashiCombatJointData.js';
import {V177_JOINT_ATLASES,v177JointPose,v177CaptureJointPose} from '../app/v177JointPresentation.js';
const dir='assets/source/quality-20261028/rigs/miyamoto-musashi-combat-r1';
const d=JSON.parse(await readFile(`${dir}/parts.json`));
const hash=b=>createHash('sha256').update(b).digest('hex');

test('MUSASHI uses his own complete generated body and preserved source-bound hidden cloth',async()=>{
 assert.equal(V177_JOINT_ATLASES['miyamoto-musashi'],atlas);
 assert.equal(d.identityBinding.modelSource,'assets/source/quality-20261028/identity/musashi-master-r4.png');
 assert.equal(hash(await readFile(d.identityBinding.modelSource)),d.identityBinding.modelSha256);
 assert.equal(hash(await readFile(d.modelSource)),d.sourceSha256);
 assert.equal(hash(await readFile(d.sourceOperation.underpainting)),d.sourceOperation.underpaintingSha256);
 assert.equal(d.parts.length,atlas.parts.length);
 for(const part of d.parts){
  assert.equal(hash(await readFile(`${dir}/${part.file}`)),part.sha256,part.name);
  assert.ok(['model','under','registeredBoot'].includes(part.source),'Every part is from this full-body family, not a retained cartoon body');
 }
 assert.deepEqual(d.parentAttachments.head.pivot,atlas.parentAttachments.head.pivot);
});

test('the actual katana tip socket belongs to opaque weapon paint and current distribution has one preferred body',async()=>{
 const pixels=await sharp(`${dir}/near-sword-hand.png`).ensureAlpha().raw().toBuffer();
 const [x,y]=atlas.muzzle.map(Math.floor);
 assert.ok(pixels[(y*480+x)*4+3]>=200,'Contact must be on the visible blade tip');
 const manifest=JSON.parse(await readFile('public/asset-manifest.json'));
 const rows=manifest.assets.filter(a=>a.path===atlas.path);assert.equal(rows.length,1);
 const bytes=await readFile('public'+atlas.path);
 assert.equal(rows[0].bytes,bytes.length);assert.equal(rows[0].hash,'sha256-'+hash(bytes));
 assert.ok(!manifest.assets.some(a=>a.path==='/art/v100/joints/miyamoto-musashi-quality-neck-r4.webp'),'retired head-only texture is not downloaded alongside current body');
 assert.ok(atlas.decodedBytes<=512*1024);
});

test('each of the Musashi swords owns one hand through actual interpolated movement and attacks',async()=>{
 assert.deepEqual(d.armConstraints.map(c=>c.effectorBone),['weapon-0','weapon-1']);
 assert.equal(d.rig.weapons.length,2);assert.equal(d.rig.firearm,false);
 const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
 for(const w of d.rig.weapons){
  const part=d.parts.find(p=>p.bone===w.name);assert.ok(part);
  const pixels=await sharp(dir+'/'+part.file).ensureAlpha().raw().toBuffer();
  const[x,y]=w.b.map(Math.floor);assert.ok(pixels[(y*480+x)*4+3]>=128,w.name+' tip belongs to own painted blade');
 }
 for(const sequence of [0,1,2])for(const state of ['move','idle','wind-up','active','recovery'])for(let n=0;n<=60;n++){
  const phase=n/60,plan=v177JointPose('miyamoto-musashi',{requestedState:state,clipProgress:phase},{locomotionPhase:phase,locomotionSettle:state==='move'?0:1},{actor:{attackSequence:sequence+(state==='wind-up'?0:1),attackWindup:state==='wind-up'?1:0}});
  const pose=v177CaptureJointPose('miyamoto-musashi',plan);
  for(const a of d.armConstraints){
   const wrist=point(pose.upper[a.lowerBone],a.wrist),grip=point(pose.upper[a.effectorBone],a.wrist);
   assert.ok(Math.hypot(wrist[0]-grip[0],wrist[1]-grip[1])<.002,state+' '+a.effectorBone+' wrist remains on its own hand');
   const upper=point(pose.upper[a.upperBone],a.elbow),lower=point(pose.upper[a.lowerBone],a.elbow);
   assert.ok(Math.hypot(upper[0]-lower[0],upper[1]-lower[1])<.002,'continuous elbow');
  }
  if(state!=='move'){
   const hips=d.rig.legs.map(l=>point(pose.lower.pelvis,l.hip));
   const feet=d.rig.legs.map((l,i)=>point(pose.lower['leg-'+i+'-foot'],l.ankle));
   assert.ok((hips[0][0]-hips[1][0])*(feet[0][0]-feet[1][0])>0,'resting feet retain hip order');
  }
 }
});
