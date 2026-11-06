import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {QUALITY_GANTETSU_COMBAT_ATLAS as atlas} from '../app/qualityGantetsuCombatJointData.js';
import {V177_JOINT_ATLASES,v177JointPose,v177CaptureJointPose} from '../app/v177JointPresentation.js';
const dir='assets/source/quality-20261028/rigs/guardian-combat-r1';
const d=JSON.parse(await readFile(`${dir}/parts.json`));
const hash=b=>createHash('sha256').update(b).digest('hex');

test('the tall shield stays upright throughout the guard ability, with its impact socket on its front face',()=>{
 for(let n=0;n<=60;n++){
  const plan=v177JointPose('guardian',{requestedState:'active',clipProgress:n/60,abilityPresentation:'guard'},{locomotionPhase:.2,locomotionSettle:1});
  assert.equal(plan.abilityPresentation,'guard');
  const m=v177CaptureJointPose('guardian',plan).upper['weapon-0'];
  assert.ok(Math.abs(Math.atan2(m[1],m[0]))<.001,'A raised guard does not turn the long shield sideways');
 }
});

test('GANTETSU uses his own complete generated body and preserved source-bound hidden cloth',async()=>{
 assert.equal(V177_JOINT_ATLASES.guardian,atlas);
 assert.equal(d.identityBinding.modelSource,'assets/source/quality-20261028/identity/gantetsu-master-r4.png');
 assert.equal(hash(await readFile(d.identityBinding.modelSource)),d.identityBinding.modelSha256);
 assert.equal(hash(await readFile(d.modelSource)),d.sourceSha256);
 assert.equal(hash(await readFile(d.sourceOperation.underpainting)),d.sourceOperation.underpaintingSha256);
 assert.equal(d.parts.length,atlas.parts.length);
 for(const part of d.parts){
  assert.equal(hash(await readFile(`${dir}/${part.file}`)),part.sha256,part.name);
  assert.ok(['model','under','farUpper','farForearm'].includes(part.source),'Every part is from this full-body family, not a retained cartoon body');
 }
 assert.deepEqual(d.parentAttachments.head.pivot,atlas.parentAttachments.head.pivot);
});

test('Gantetsu elbows retain the bend side of his own painted arms in movement and the shield bash',()=>{
 const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
 const bend=(s,e,w)=>(e[0]-s[0])*(w[1]-s[1])-(e[1]-s[1])*(w[0]-s[0]);
 for(const state of ['move','idle','wind-up','active','recovery'])for(let n=0;n<=60;n++){
  const phase=n/60,plan=v177JointPose('guardian',{requestedState:state,clipProgress:phase},{locomotionPhase:phase,locomotionSettle:state==='move'?0:1});
  const {upper}=v177CaptureJointPose('guardian',plan);
  for(const a of d.armConstraints){
   const s=point(upper[a.upperBone],a.shoulder),e=point(upper[a.upperBone],a.elbow),w=point(upper[a.lowerBone],a.wrist);
   assert.ok(bend(s,e,w)*bend(a.shoulder,a.elbow,a.wrist)>0,state+' '+a.upperBone+' follows the source elbow, not its mirrored solution');
  }
 }
});

test('the actual weapon contact socket belongs to opaque weapon paint and current distribution has one preferred body',async()=>{
 const pixels=await sharp(`${dir}/weapon-and-hands.png`).ensureAlpha().raw().toBuffer();
 const [x,y]=atlas.muzzle.map(Math.floor);
 assert.ok(pixels[(y*480+x)*4+3]>=200,'Contact must be on the visible weapon contact');
 const manifest=JSON.parse(await readFile('public/asset-manifest.json'));
 const rows=manifest.assets.filter(a=>a.path===atlas.path);assert.equal(rows.length,1);
 const bytes=await readFile('public'+atlas.path);
 assert.equal(rows[0].bytes,bytes.length);assert.equal(rows[0].hash,'sha256-'+hash(bytes));
 assert.ok(!manifest.assets.some(a=>a.path==='/art/v100/joints/guardian-quality-neck-r4.webp'),'retired head-only texture is not downloaded alongside current body');
 assert.ok(atlas.decodedBytes<=512*1024);
});
