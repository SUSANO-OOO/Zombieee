import {spriteFrameFor} from '../app/spriteManifest.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {V177_JOINT_ATLASES,v177JointPose,v177CaptureJointPose} from '../app/v177JointPresentation.js';
import {v177WeaponChoreography} from '../app/v177WeaponChoreography.js';
import {QUALITY_BATTLE_HEAD_CALIBRATIONS} from '../app/qualityBattleHeadCalibrationData.js';
import {QUALITY_CHARACTER_BASE_ATLASES} from '../app/qualityCharacterAtlases.js';
const calibration=JSON.parse(await readFile('assets/source/quality-20261028/identity/battle-neck-calibration-r4.json'));
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];

test('all calibrated human/helmet materials retain their own torso garment and an unclipped head',async()=>{
 assert.equal(Object.keys(QUALITY_BATTLE_HEAD_CALIBRATIONS).length,13);
 for(const kind of Object.keys(QUALITY_BATTLE_HEAD_CALIBRATIONS)){
  const atlas=V177_JOINT_ATLASES[kind],rig=atlas.parts?atlas:atlas.upperRig;
  assert.equal(atlas.path,QUALITY_BATTLE_HEAD_CALIBRATIONS[kind].path);
  const original=QUALITY_CHARACTER_BASE_ATLASES[kind],originalRig=original.parts?original:original.upperRig;
  assert.deepEqual(rig.parentAttachments,originalRig.parentAttachments,'material registration must not silently replace a reaction pivot');
  const head=rig.parts.find(p=>p.bone==='head'),s=head.source;
  const{data,info}=await sharp('public'+atlas.path).extract({left:s.x,top:s.y,width:s.w,height:s.h}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(x===0||y===0||x===info.width-1||y===info.height-1)
   assert.ok(data[(y*info.width+x)*4+3]<8,kind+': no clipped hair, mask or skin at packed head boundary');
  const garment=rig.parts.find(p=>p.name==='source-neck-garment');if(garment){assert.equal(garment.bone,'spine');assert.equal(garment.upper,true);}
 }
 for(const kind of ['crazy-king','mayo-chan'])assert.equal(QUALITY_BATTLE_HEAD_CALIBRATIONS[kind],undefined,'toy/dog are not human-neck replacements');
});

test('material registration retains the original anatomical joint through actual rigid pose resolution and weapon choreography',()=>{
 for(const kind of Object.keys(QUALITY_BATTLE_HEAD_CALIBRATIONS)){
  const atlas=V177_JOINT_ATLASES[kind];if(atlas.type!=='rigid-parts')continue;
  for(const state of ['move','idle','wind-up','active','recovery'])for(let n=0;n<30;n++){
   const p=n/30,runtime={moving:state==='move',locomotionPhase:p,locomotionSettle:state==='move'?0:1,direction:'right'};
   const base=v177JointPose(kind,{requestedState:state,clipProgress:p},runtime,{actor:{kind,animationPresentation:runtime}});assert.ok(base,kind+'/'+state);
   const plan=v177WeaponChoreography(kind,atlas,{...base,paintLocomotion:{phase:p,settle:runtime.locomotionSettle}});
   const pivot=calibration.entries.find(e=>e.kind===kind).rigPivot;
   const captured=v177CaptureJointPose(kind,plan),a=point(captured.upper.head,pivot),b=point(captured.upper.spine,pivot);
   assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<.002,kind+'/'+state+'/'+n+' visible neck attachment');
  }
 }
});

test('the complete Kuma combat painting is registered to the visible road contact instead of the old walking-study frame',async()=>{
 const atlas=V177_JOINT_ATLASES.kumaverson;
 const d=JSON.parse(await readFile('assets/source/quality-20261028/rigs/kumaverson-combat-r4/parts.json'));
 assert.equal(atlas.path,'/art/v100/joints/kumaverson-combat-r4.webp');
 assert.equal(d.identityBinding.modelSource,'assets/source/quality-20261028/identity/kumaverson-master-r2.png');
 let sole=0;
 for(const name of ['far-boot','near-boot']){
  const{data,info}=await sharp(`assets/source/quality-20261028/rigs/kumaverson-combat-r4/${name}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let i=0;i<info.width*info.height;i++)if(data[i*4+3]>=32)sole=Math.max(sole,Math.floor(i/info.width)+1);
 }
 assert.ok(Math.abs((sole-atlas.referenceFrame.ty)/atlas.referenceFrame.scale-atlas.referenceFrame.height*spriteFrameFor('kumaverson','walk-a','right').anchorY)<1e-8,'painted soles meet the game ground anchor');
 assert.deepEqual(Object.entries(V177_JOINT_ATLASES).filter(([,a])=>a.reserveBipedLanding).map(([kind])=>kind),['kumaverson'],'new landing reserve does not silently alter other rigs');
});
