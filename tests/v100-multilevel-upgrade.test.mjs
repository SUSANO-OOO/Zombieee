import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultV100Save,normalizeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {upgradeV100Unit} from '../app/v100Transactions.js';
import {v100UnitPresentation} from '../app/v100UnitPresentation.js';

function fixture(caps=5000){return normalizeV100Save({...createDefaultV100Save(),caps,levelCap:15,
 ownedUnitIds:V100_UNITS.map(u=>u.id),registeredUnitIds:V100_UNITS.map(u=>u.id),completedStageIds:V100_STAGE_IDS.slice(0,14),
 equipment:{inventory:{'reinforced-vest':1,'rescue-pouch':1},personalByUnit:{'unit-nao':['reinforced-vest','rescue-pouch']},tacticalIds:[null,null],enhancementLevels:{'rescue-pouch':2}}});}

test('one purchase reaches the selected level with exactly the original costs, receipts and battle stats for all sixteen allies',()=>{
 for(const unit of V100_UNITS){
  const before=fixture(),serialized=JSON.stringify(before),quote=v100UnitPresentation(before,unit.id,{targetLevel:10});
  let sequential=before;for(let level=1;level<10;level++){const next=upgradeV100Unit(sequential,unit.id,{expectedLevel:level});assert.ok(next.applied);sequential=next.save;}
  const bulk=upgradeV100Unit(before,unit.id,{expectedLevel:1,targetLevel:10});assert.ok(bulk.applied);
  assert.equal(bulk.save.caps,sequential.caps);assert.equal(before.caps-bulk.save.caps,quote.upgradeCost);
  assert.deepEqual(bulk.save.unitLevels,sequential.unitLevels);assert.deepEqual(bulk.save.receipts,sequential.receipts);
  assert.deepEqual(quote.next,v100UnitPresentation(bulk.save,unit.id).current);
  for(const key of Object.keys(before).filter(k=>!['caps','unitLevels','receipts','revision','updatedAt'].includes(k)))assert.deepEqual(bulk.save[key],before[key],key);
  assert.equal(bulk.save.revision,before.revision+1);assert.equal(JSON.stringify(before),serialized);
  assert.equal(upgradeV100Unit(bulk.save,unit.id,{expectedLevel:1,targetLevel:10}).reason,'stale-level');
 }
});

test('insufficient total budget or an intermediate duplicate receipt rejects the entire purchase',()=>{
 for(const before of [fixture(30),{...fixture(),receipts:['v100:unit:unit-nao:level:7']}]){
  const pristine=JSON.stringify(before),result=upgradeV100Unit(before,'unit-nao',{expectedLevel:1,targetLevel:10});
  assert.equal(result.applied,false);assert.ok(['insufficient-caps','duplicate-receipt'].includes(result.reason));
  assert.equal(JSON.stringify(before),pristine);assert.equal(result.save.caps,before.caps);assert.deepEqual(result.save.unitLevels,before.unitLevels);
 }
});

test('targets cannot lower levels, exceed earned caps, bypass ownership or use non-integers',()=>{
 const before=fixture();
 for(const targetLevel of [0,1,-2,2.5,NaN,Infinity,'10'])assert.equal(upgradeV100Unit(before,'unit-nao',{targetLevel}).applied,false);
 assert.equal(upgradeV100Unit(before,'unit-nao',{targetLevel:16}).reason,'level-cap');
 assert.equal(upgradeV100Unit(createDefaultV100Save(),'unit-nao',{targetLevel:5}).reason,'unit-not-owned');
 const initial={...createDefaultV100Save(),caps:5000};
 assert.equal(upgradeV100Unit(initial,'unit-hachi',{targetLevel:6}).reason,'level-cap');
 assert.equal(upgradeV100Unit(initial,'unit-hachi',{targetLevel:5}).save.unitLevels['unit-hachi'],5);
});
