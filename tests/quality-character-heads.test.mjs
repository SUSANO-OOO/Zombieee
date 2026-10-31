import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {QUALITY_CHARACTER_BASE_ATLASES as bases,QUALITY_CHARACTER_HEAD_ATLASES} from '../app/qualityCharacterAtlases.js';
import {QUALITY_SIDEARM_RETAINED_BASE} from '../app/qualitySidearmAtlas.js';
import {CAMPAIGN_UNITS} from '../app/campaign.js';
import {QUALITY_BATTLE_HEAD_CALIBRATIONS} from '../app/qualityBattleHeadCalibrationData.js';
import {QUALITY_KUMAVERSON_COMBAT_ATLAS} from '../app/qualityKumaversonCombatJointData.js';
const legacy=JSON.parse(await readFile('assets/source/quality-20261028/identity/head-runtime-provenance.json','utf8'));
const completed=JSON.parse(await readFile('assets/source/quality-20261028/identity/battle-heads-r3/runtime-provenance.json','utf8'));
const provenance={entries:[...legacy.entries.filter(row=>!completed.entries.some(next=>next.kind===row.kind)),...completed.entries]};
test('normal battle-head assignments cover the complete playable roster without mixing character kinds',()=>{
 assert.deepEqual([...new Set(CAMPAIGN_UNITS.map(unit=>unit.combatKind))].sort(),Object.keys(bases).sort());
 assert.equal(provenance.entries.length,16);assert.equal(new Set(provenance.entries.map(row=>row.kind)).size,16);
});
const manifest=JSON.parse(await readFile('public/asset-manifest.json','utf8'));
for(const [kind,base] of Object.entries(bases))test(kind+' keeps its checked identity lineage and the correct current runtime material',async()=>{
 const current=QUALITY_CHARACTER_HEAD_ATLASES[kind],preferred=V177_JOINT_ATLASES[kind],entry=provenance.entries.find(e=>e.kind===kind);
 if(kind==='kumaverson')assert.deepEqual(preferred,QUALITY_KUMAVERSON_COMBAT_ATLAS,'The current combat body replaces the retired head-only approach');
 else if(QUALITY_BATTLE_HEAD_CALIBRATIONS[kind]){
  const update=QUALITY_BATTLE_HEAD_CALIBRATIONS[kind],rig=preferred.parts?preferred:preferred.upperRig;
  assert.equal(preferred.path,update.path);assert.deepEqual(rig.parts,update.parts);
  const originalRig=base.parts?base:base.upperRig;if(kind==='babayaga'){
   for(const[i,pose]of rig.poses.entries()){const original=originalRig.poses[i];for(const[bone,m]of Object.entries(original))assert.deepEqual(pose[bone],m,'Original action bone stays source-bound');assert.deepEqual(pose['arm-1-hand'],original.spine,'Supplemental independent wrist control follows body source');}
   assert.equal(rig.armPosePolicy,'one-handed-pistol-and-free-arm');
  }else assert.deepEqual(rig.poses,originalRig.poses,'Source pose angles remain source-bound');
  assert.deepEqual(rig.parentAttachments,originalRig.parentAttachments,'Original anatomical pivots and reaction owners remain source-bound');
 }else assert.deepEqual(preferred,current,'The original dog/toy head remains intentionally distinct');
 assert.equal(current.path,entry.assetPath);assert.notEqual(current.path,base.path);
 assert.deepEqual({...current,path:base.path},base);
 const bytes=await readFile(kind==='babayaga'?QUALITY_SIDEARM_RETAINED_BASE:'public'+current.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 assert.ok(manifest.assets.some(a=>a.path===preferred.path),'preferred runtime asset is distributable');
 const a=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp('public'+base.path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(a.info.width,b.info.width);assert.equal(a.info.height,b.info.height);
 const head=(base.parts??base.upperRig.parts).find(p=>p.bone==='head').source;let changedHeadPixels=0;
 for(let y=0;y<a.info.height;y++)for(let x=0;x<a.info.width;x++){
  const i=(y*a.info.width+x)*4,inside=x>=head.x&&x<head.x+head.w&&y>=head.y&&y<head.y+head.h;
  if(inside){if(!a.data.subarray(i,i+4).equals(b.data.subarray(i,i+4)))changedHeadPixels++;continue;}
  assert.equal(a.data[i+3],b.data[i+3]);if(b.data[i+3]>0)assert.ok(a.data.subarray(i,i+3).equals(b.data.subarray(i,i+3)),'body/weapon pixel changed outside head');
 }
 assert.ok(changedHeadPixels>10,'head actually differs');
});
