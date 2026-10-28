import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {COMBAT_ANIMATION_STATES,animationClipFor,sampleAnimationClip} from '../app/combatPresentation.js';
import {spriteFrameFor,spriteSheetPath,SPRITE_STATES} from '../app/spriteManifest.js';
import {V177_JOINT_ATLASES,v177JointPose} from '../app/v177JointPresentation.js';
import {V177_PAISEN_PHOTO_SPRITES as data} from '../app/v177PaisenPhotoSpriteData.js';
import {v100UsesHumanWalk} from '../app/v100HumanWalk.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {CAMPAIGN_STAGE_IDS} from '../app/campaign.js';
import {alphaBounds,decodeRgbaPng,hasTransparentPerimeter} from './image-asset-helpers.mjs';

test('all21 live Paisen routes use the opponent-facing photo source in both directions, including separate pose owners',()=>{
 assert.equal(COMBAT_ANIMATION_STATES.length,21);assert.equal(Object.keys(V177_JOINT_ATLASES).length,48);
 assert.equal(spriteSheetPath('brawler'),data.sixPath);assert.equal(V177_JOINT_ATLASES.brawler.path,'/art/v100/joints/brawler-quality-head-r1.webp');
 const parts=V177_JOINT_ATLASES.brawler.parts;assert.ok(parts.findIndex(p=>p.name==='head')<parts.findIndex(p=>p.name==='torso'));
 let samples=0;
 for(const state of COMBAT_ANIMATION_STATES)for(const direction of ['left','right'])for(const p of [0,.2,.5,.8,.99]){
  const clip=animationClipFor('brawler',state),sample=sampleAnimationClip('brawler',state,clip.durationSeconds*p);
  const frame=spriteFrameFor('brawler',sample.spriteState,direction);
  assert.equal(frame.path,data.sixPath);assert.equal(frame.drawSlices,undefined,'New body cannot inherit retired neighbour masks');
  assert.equal(v100UsesHumanWalk('brawler',sample),false,'The old polygon body cannot replace a missing photo rig');
  assert.equal(v177JointPose('brawler',sample,{locomotionPhase:.37,locomotionSettle:1},{ownedPose:true}),null);
  samples++;
 }
 assert.equal(samples,210);
});

test('every fallback source pixel, alpha bound, sixteen-pixel gutter and lossless transport belongs to the same new body',async()=>{
 const png=await readFile(new URL('../public'+data.sixPath,import.meta.url));
 const author=await readFile(new URL('../assets/source/v177/paisen/battle-r8/authored-fallback-six-r1.png',import.meta.url));
 assert.deepEqual(png,author);assert.equal(createHash('sha256').update(png).digest('hex'),data.sixSha256);
 const decoded=decodeRgbaPng(png);
 for(const state of SPRITE_STATES)for(const direction of ['left','right']){
  const frame=spriteFrameFor('brawler',state,direction);
  assert.deepEqual(alphaBounds(decoded,frame.sourceRect),frame.contentRect);
  assert.ok(hasTransparentPerimeter(decoded,frame.sourceRect,16));
  let rasterFloor=-1;for(let y=0;y<frame.h;y++)for(let x=0;x<frame.w;x++)if(decoded.data[((frame.y+y)*decoded.width+frame.x+x)*4+3]>=8)rasterFloor=Math.max(rasterFloor,y+1);
  assert.equal(rasterFloor,frame.groundAnchorPixels,'The actual rasterized foot edge owns the fallback ground anchor');
 }
 const manifest=JSON.parse(await readFile(new URL('../public/asset-manifest.json',import.meta.url)));
 const asset=manifest.assets.find(a=>a.path===data.sixPath);assert.ok(asset);
 const source=await sharp(png).ensureAlpha().raw().toBuffer();
 const transport=await sharp(await readFile(new URL('../public'+asset.sourcePath,import.meta.url))).ensureAlpha().raw().toBuffer();
 assert.equal(source.length,transport.length);let visible=0;
 for(let i=0;i<source.length;i+=4){assert.equal(source[i+3],transport[i+3]);if(source[i+3]){assert.deepEqual(source.subarray(i,i+3),transport.subarray(i,i+3));visible++;}}
 assert.equal(visible,343883);
});

test('selected battle loads the complete photo body while retired battle and joint sources stay outside the runtime pack',async()=>{
 const plan=requiredBattleAssetPlan({stageId:CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,formationKinds:['brawler'],enemyKinds:['walker']});
 for(const path of [data.sixPath,V177_JOINT_ATLASES.brawler.path])assert.ok(plan.paths.includes(path));
 const manifest=JSON.parse(await readFile(new URL('../public/asset-manifest.json',import.meta.url)));
 for(const path of ['/art/v060/characters/legacy/brawler-battle-gutter-v1.png','/art/v100/joints/brawler-r1.webp',data.jointPath]){
  assert.ok(!plan.paths.includes(path));assert.ok(!manifest.assets.some(a=>a.path===path));
 }
});
