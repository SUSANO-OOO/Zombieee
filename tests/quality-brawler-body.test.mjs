import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {QUALITY_PAISEN_COMBAT_ATLAS as atlas} from '../app/qualityPaisenCombatJointData.js';
import {V177_JOINT_ATLASES,v177JointPose,v177CaptureJointPose} from '../app/v177JointPresentation.js';
const dir='assets/source/quality-20261028/rigs/brawler-combat-r1';
const d=JSON.parse(await readFile(`${dir}/parts.json`));
const hash=b=>createHash('sha256').update(b).digest('hex');

test('Paisen knees bend toward the enemy and both shoes meet the actual photo-frame ground anchor',async()=>{
 const {spriteFrameFor}=await import('../app/spriteManifest.js');
 const frame=spriteFrameFor('brawler','walk-a','right'),ref=atlas.referenceFrame;
 assert.ok(Math.abs((d.motion.walk.groundY-ref.ty)/ref.scale-ref.height*frame.anchorY)<1e-8);
 const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
 for(let n=0;n<=120;n++)for(const settle of [0,.5,1]){
  const plan=v177JointPose('brawler',{requestedState:'move'},{locomotionPhase:n/120,locomotionSettle:settle});
  const {lower}=v177CaptureJointPose('brawler',plan);
  for(const l of d.legConstraints){
   const h=point(lower[l.upperBone],l.hip),k=point(lower[l.upperBone],l.knee),a=point(lower[l.lowerBone],l.ankle);
   assert.ok((k[0]-h[0])*(a[1]-h[1])-(k[1]-h[1])*(a[0]-h[0])>0,'Right-facing knee must not fold behind the hip/ankle axis');
  }
 }
});

test('PAISEN uses his own complete generated body and preserved source-bound hidden cloth',async()=>{
 assert.equal(V177_JOINT_ATLASES.brawler,atlas);
 assert.equal(d.identityBinding.modelSource,'assets/source/quality-20261028/identity/paisen-photo-master-r7.png');
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

test('Paisen elbows retain the bend side of his own painted arms in movement and the punch',()=>{
 const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
 const bend=(s,e,w)=>(e[0]-s[0])*(w[1]-s[1])-(e[1]-s[1])*(w[0]-s[0]);
 for(const state of ['move','idle','wind-up','active','recovery'])for(let n=0;n<=60;n++){
  const phase=n/60,plan=v177JointPose('brawler',{requestedState:state,clipProgress:phase},{locomotionPhase:phase,locomotionSettle:state==='move'?0:1});
  const {upper}=v177CaptureJointPose('brawler',plan);
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
 assert.ok(!manifest.assets.some(a=>a.path==='/art/v100/joints/brawler-quality-neck-r4.webp'),'retired head-only texture is not downloaded alongside current body');
 assert.ok(atlas.decodedBytes<=512*1024);
});
