import test from 'node:test';
import assert from 'node:assert/strict';
import {UNIT_CONTENT} from '../app/content/unitCatalog.js';
import {V100_STAGES} from '../app/v100Registry.js';
import {applyV100UnitLevelProgression} from '../app/v100Progression.js';
import {v100UnitPresentation} from '../app/v100UnitPresentation.js';
import {createDefaultV100Save} from '../app/v100Save.js';
import {campaignUnitIdToCombatKind} from '../app/campaign.js';
import {v100IncreaseWaveDensity} from '../app/v100CombatTuning.js';
import {v100BattleDefinitionFor} from '../app/v100BattleAdapter.js';
import {v100MainHumanWalkPose} from '../app/v100MainHumanWalk.js';

test('fractional reinforcements increase a whole timeline moderately without duplicating bosses or changing gates',()=>{
 const boss='takuya';
 const timeline=Object.freeze([
  Object.freeze({at:4,wave:1,units:Object.freeze(['walker','runner'])}),
  Object.freeze({at:20,wave:2,units:Object.freeze(['runner','walker'])}),
  Object.freeze({at:30,wave:3,units:Object.freeze([]),label:'warning'}),
  Object.freeze({at:40,wave:4,units:Object.freeze([boss]),waitForPriorWaveClear:true}),
  Object.freeze({at:50,wave:5,units:Object.freeze(['walker','red-panther-commander','runner']),bossHpRatio:.5,addWave:true}),
 ]);
 const next=v100IncreaseWaveDensity(timeline,[boss]);
 assert.equal(next.flatMap(w=>w.units).length,9); // seven ordinary + one boss + one reinforcement
 assert.equal(next.flatMap(w=>w.units).filter(k=>k===boss).length,1);
 assert.equal(next.flatMap(w=>w.units).filter(k=>k==='red-panther-commander').length,1);
 for(let i=0;i<timeline.length;i++){
  assert.deepEqual({...next[i],units:null},{...timeline[i],units:null});
  assert.deepEqual(next[i].units.slice(0,timeline[i].units.length),timeline[i].units);
  assert.ok(Object.isFrozen(next[i])&&Object.isFrozen(next[i].units));
 }
 assert.deepEqual(timeline[0].units,['walker','runner']);
 assert.equal(next[2],timeline[2]);assert.equal(next[3],timeline[3]);
});

test('every production stage uses the denser timeline while single and paired boss identities remain fixed',()=>{
 for(const stage of V100_STAGES){
  const definition=v100BattleDefinitionFor(stage.id),timeline=definition.timeline;
  assert.ok(timeline.length>0);
  assert.ok(timeline.every((event,index)=>index===0||event.at>timeline[index-1].at));
  if(definition.bossEnemyKind)assert.equal(timeline.flatMap(w=>w.units).filter(k=>k===definition.bossEnemyKind).length,stage.number===24?2:1,stage.displayName);
 }
 const before=v100BattleDefinitionFor(V100_STAGES[0].id).timeline;
 assert.equal(before.reduce((n,w)=>n+w.units.length,0),21); // eighteen authored enemies + three
});

test('the displayed card and actual battle share damage and mobility changes at every permanent level',()=>{
 const save=createDefaultV100Save();
 for(const unitId of Object.keys(save.unitLevels))assert.ok(typeof save.unitLevels[unitId]==='number');
 for(const base of UNIT_CONTENT)for(const level of [1,2,5,15,30]){
  const unitId=Object.keys(save.unitLevels).find(id=>campaignUnitIdToCombatKind(id)===base.kind)
    ?? base.aliases[0];
  save.unitLevels[unitId]=level;
  const quote=v100UnitPresentation(save,unitId),card=applyV100UnitLevelProgression(base,level);
  assert.equal(quote.current.damage,card.damage,base.kind);
  assert.equal(quote.current.speed,card.speed,base.kind);
  assert.equal(quote.current.laneSpeed,card.laneSpeed,base.kind);
  assert.ok(card.damage>base.damage&&card.speed>base.speed&&card.laneSpeed>base.laneSpeed);
  assert.equal(card.attackEvery,base.attackEvery);assert.equal(card.range,base.range);
  assert.equal(card.cost,base.cost);assert.equal(card.deployCooldown,base.deployCooldown);
 }
});

test('Nao, Mizuchi and Monkey keep an upright supporting hip rather than the generic ten-pixel crouch',()=>{
 for(const kind of ['medic','ranger','engineer'])for(const phase of [0,.2,.5,.7]){
  const pose=v100MainHumanWalkPose(kind,phase);
  const support=[pose.near,pose.far].find(leg=>leg.planted);
  assert.ok((support.point[1]-support.hip[1])/(pose.upper+pose.lower)>.92,kind);
 }
});
