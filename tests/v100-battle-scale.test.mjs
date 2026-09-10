import test from 'node:test';
import assert from 'node:assert/strict';
import {spriteFrameFor,fitSpriteBattleDisplaySize,spriteBattleDisplaySizeFor} from '../app/spriteManifest.js';
import {sampleAnimationClip} from '../app/combatPresentation.js';
import {enemySpawnPortalPoint} from '../app/battleSpace.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
const standingHeight=kind=>{const f=spriteFrameFor(kind,'idle','left'),d=fitSpriteBattleDisplaySize(kind,f,spriteBattleDisplaySizeFor(kind));return d.h*f.contentRect.h/f.sourceRect.h*sampleAnimationClip(kind,'idle',0).bodyScale;};
test('human enemies share the standing body scale, Mayo stays lower, and the first bosses dominate it',()=>{
 const humans=['scout','brawler','kumaverson','babayaga','ranger','medic'],average=humans.reduce((v,k)=>v+standingHeight(k),0)/humans.length;
 for(const kind of ['red-panther-knife','red-panther-shield','red-panther-smg','red-panther-commander'])assert.ok(Math.abs(standingHeight(kind)/average-1)<.08,kind);
 assert.ok(standingHeight('mayo-chan')<average*.75);assert.ok(standingHeight('mayo-chan-feral')<average*.8);
 for(const kind of ['takuya','gate-eater'])assert.ok(standingHeight(kind)>average*1.45,kind);
 for(const kind of ['mugarian-president-mutated','red-panther-shield'])for(const state of ['turn','hit-heavy','phase-change'])assert.equal(sampleAnimationClip(kind,state,.08).pose.opacity,1);
});
test('V1 gate entry is bounded while preserving offscreen origin and whole-body reveal',()=>{
 for(const viewport of ['standard','844x340','844x390'])for(const kind of ['walker','crusher','takuya','gate-eater']){
  const p=enemySpawnPortalPoint({stageId:V100_STAGE_IDS[4],kind,missionType:'boss-assault',v100InfectedGate:true,viewport});
  assert.ok(p.x-p.visualHalfWidth>960);
  assert.ok(p.combatReadyX+p.visualHalfWidth<=825);
  assert.ok(Math.hypot(p.x-p.combatReadyX,p.y-p.combatReadyY)/p.entrySpeed<=5.001);
  if(['takuya','gate-eater'].includes(kind))assert.equal(p.legacyLane,1);
 }
 assert.equal(enemySpawnPortalPoint({stageId:V100_STAGE_IDS[4],kind:'gate-eater',missionType:'boss-assault'}).entrySpeed,29,'legacy timing preserved');
});
test('assault enemies originate fully outside the right edge before becoming targetable',()=>{
 for(const kind of ['walker','runner','crusher']){
  const p=enemySpawnPortalPoint({stageId:V100_STAGE_IDS[0],kind,missionType:'assault',v100InfectedGate:true});
  assert.ok(p.x-p.visualHalfWidth>960);assert.ok(p.combatReadyX+p.visualHalfWidth<=825);assert.equal(p.entryMode,'right-edge-outside');
 }
});
