import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save,deserializeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_INITIAL_UNIT_IDS,V100_STAGE_IDS,v100StageReward,v100LevelCost} from '../app/v100Registry.js';
import {purchaseV100Unit,upgradeV100Unit} from '../app/v100Transactions.js';
import {v100UnitPresentation} from '../app/v100UnitPresentation.js';

const earnedAt = n => Array.from({length:n},(_,i)=>v100StageReward(i+1,'first-clear')).reduce((a,b)=>a+b,0);
const prepared = n => normalizeV100Save({...createDefaultV100Save(),caps:earnedAt(n)-50,levelCap:15,
 completedStageIds:V100_STAGE_IDS.slice(0,n),availableStageIds:V100_STAGE_IDS.slice(0,n+1),
 registeredUnitIds:V100_UNITS.filter(u=>u.availabilityStageNumber<=n).map(u=>u.id)});

test('ten minimum first clears fund every rescued ally, four level-3 starters and healing without replay income',()=>{
 let save=prepared(10);const initial=structuredClone(save);
 for(const unit of V100_UNITS.filter(u=>u.availabilityStageNumber>0&&u.availabilityStageNumber<=10)){
  const result=purchaseV100Unit(save,unit.id);assert.equal(result.applied,true,unit.id);save=result.save;
 }
 for(const id of V100_INITIAL_UNIT_IDS){const result=upgradeV100Unit(save,id,{expectedLevel:1,targetLevel:3});assert.equal(result.applied,true,id);save=result.save;}
 assert.equal(save.caps,30);assert.equal(save.ownedUnitIds.length,12);
 assert.deepEqual(save.completedStageIds,initial.completedStageIds);
 assert.deepEqual(save.equipment,initial.equipment);
 assert.deepEqual(save.bestStars,initial.bestStars);
 assert.equal(save.receipts.length,new Set(save.receipts).size);
 assert.equal(v100LevelCost(2)+v100LevelCost(3),65,'training curve remains unchanged');
});

test('each changed recruit uses its displayed price once and keeps existing stats, levels and equipment',()=>{
 for(const unit of V100_UNITS.filter(u=>u.availabilityStageNumber>=4)){
  const base=prepared(20),before=normalizeV100Save({...base,caps:unit.registrationCostCaps});
  const quote=v100UnitPresentation(before,unit.id),result=purchaseV100Unit(before,unit.id);
  assert.equal(result.applied,true);assert.equal(result.save.caps,0);assert.equal(quote.registrationCost,unit.registrationCostCaps);
  assert.deepEqual(v100UnitPresentation(result.save,unit.id).current,quote.current);
  for(const key of Object.keys(before).filter(k=>!['caps','ownedUnitIds','receipts','revision','updatedAt'].includes(k)))assert.deepEqual(result.save[key],before[key],unit.id+':'+key);
  assert.equal(result.save.revision,before.revision+1);
  assert.equal(purchaseV100Unit(result.save,unit.id).reason,'already-owned');
  assert.equal(purchaseV100Unit({...before,caps:unit.registrationCostCaps-1},unit.id).reason,'insufficient-caps');
  assert.equal(purchaseV100Unit({...before,registeredUnitIds:before.registeredUnitIds.filter(id=>id!==unit.id)},unit.id).reason,'not-registered');
  assert.equal(purchaseV100Unit({...before,receipts:[`v100:unit:${unit.id}:purchase`]},unit.id).reason,'duplicate-receipt');
 }
});

test('old paid ownership does not create refunds, recharges or reset saved progression',()=>{
 const original=normalizeV100Save({...prepared(20),caps:7,ownedUnitIds:V100_UNITS.map(u=>u.id),
  unitLevels:Object.fromEntries(V100_UNITS.map(u=>[u.id,7])),receipts:V100_UNITS.filter(u=>!u.initial).map(u=>`v100:unit:${u.id}:purchase`),
  equipment:{inventory:{'reinforced-vest':1},personalByUnit:{'unit-gantetsu':['reinforced-vest',null]},enhancementLevels:{'reinforced-vest':2}}});
 const loaded=deserializeV100Save(serializeV100Save(original)).save;assert.deepEqual(loaded,original);
 for(const unit of V100_UNITS){const result=purchaseV100Unit(loaded,unit.id);assert.equal(result.applied,false);assert.deepEqual(result.save,original);}
});
