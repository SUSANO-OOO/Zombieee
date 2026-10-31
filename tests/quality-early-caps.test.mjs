import test from'node:test';
import assert from'node:assert/strict';
import{createDefaultV100Save,normalizeV100Save,serializeV100Save,deserializeV100Save}from'../app/v100Save.js';
import{V100_STAGE_IDS,V100_UNIT_IDS,v100LevelCost}from'../app/v100Registry.js';
import{createV100BattleResult,recordV100PendingResult,finalizeV100PendingResult,purchaseV100Unit,upgradeV100Unit}from'../app/v100Transactions.js';

function firstClear(){
 const save=createDefaultV100Save({}),result=createV100BattleResult({stageId:V100_STAGE_IDS[0],battleRunId:'quality-early-caps-s01',won:true,objectiveComplete:true,vehicleHp:1,vehicleMaxHp:680,unitDeaths:4});
 const pending=recordV100PendingResult(save,result);assert.equal(pending.applied,true);
 const earned=finalizeV100PendingResult(pending.save);assert.equal(earned.applied,true);assert.equal(earned.save.caps,87);
 assert.ok(earned.save.registeredUnitIds.includes(V100_UNIT_IDS.NAO));return earned.save;
}

test('the lowest S01 first-clear award funds Nao and one real level upgrade without replay or gifts',()=>{
 const earned=firstClear(),joined=purchaseV100Unit(earned,V100_UNIT_IDS.NAO);assert.equal(joined.applied,true);assert.equal(joined.save.caps,32);
 assert.equal(v100LevelCost(2),30);
 const upgraded=upgradeV100Unit(joined.save,V100_UNIT_IDS.BABAYAGA,{expectedLevel:1});assert.equal(upgraded.applied,true);assert.equal(upgraded.save.caps,2);assert.equal(upgraded.save.unitLevels[V100_UNIT_IDS.BABAYAGA],2);
 for(const key of['bestStars','completedStageIds','equipment','settings'])assert.deepEqual(upgraded.save[key],earned[key],key);
 const duplicate=purchaseV100Unit(upgraded.save,V100_UNIT_IDS.NAO);assert.equal(duplicate.applied,false);assert.equal(duplicate.reason,'already-owned');assert.deepEqual(duplicate.save,upgraded.save);
});

test('the two lowest first-clear awards also fund Mizuchi after Nao and the first field upgrade',()=>{
 const joined=purchaseV100Unit(firstClear(),V100_UNIT_IDS.NAO),upgraded=upgradeV100Unit(joined.save,V100_UNIT_IDS.BABAYAGA,{expectedLevel:1});
 assert.equal(upgraded.applied,true);
 const result=createV100BattleResult({stageId:V100_STAGE_IDS[1],battleRunId:'quality-early-caps-s02',won:true,objectiveComplete:true,vehicleHp:1,vehicleMaxHp:680,unitDeaths:4});
 const pending=recordV100PendingResult(upgraded.save,result);assert.equal(pending.applied,true);
 const earned=finalizeV100PendingResult(pending.save);assert.equal(earned.applied,true);assert.equal(earned.save.caps,96);
 const recruited=purchaseV100Unit(earned.save,V100_UNIT_IDS.MIZUCHI);assert.equal(recruited.applied,true);assert.equal(recruited.save.caps,1);
 assert.ok(recruited.save.ownedUnitIds.includes(V100_UNIT_IDS.NAO));assert.ok(recruited.save.ownedUnitIds.includes(V100_UNIT_IDS.MIZUCHI));assert.equal(recruited.save.unitLevels[V100_UNIT_IDS.BABAYAGA],2);
 assert.deepEqual(recruited.save.completedStageIds,earned.save.completedStageIds);
});

test('the lower preparation price still rejects missing funds and a locked rescue without changing saves',()=>{
 const poor=normalizeV100Save({...firstClear(),caps:54}),insufficient=purchaseV100Unit(poor,V100_UNIT_IDS.NAO);
 assert.equal(insufficient.applied,false);assert.equal(insufficient.reason,'insufficient-caps');assert.deepEqual(insufficient.save,poor);
 const locked=normalizeV100Save({...createDefaultV100Save({}),caps:1000}),unavailable=purchaseV100Unit(locked,V100_UNIT_IDS.NAO);
 assert.equal(unavailable.applied,false);assert.equal(unavailable.reason,'not-registered');assert.deepEqual(unavailable.save,locked);
});

test('an existing 85-CAPS Nao purchase survives round-trip without a refund, charge or duplicate reward',()=>{
 const earned=firstClear(),old=normalizeV100Save({...earned,caps:2,ownedUnitIds:[...earned.ownedUnitIds,V100_UNIT_IDS.NAO],receipts:[...earned.receipts,'v100:unit:unit-nao:purchase']});
 const decoded=deserializeV100Save(serializeV100Save(old));assert.equal(decoded.ok,true);assert.deepEqual(decoded.save,old);
 const duplicate=purchaseV100Unit(decoded.save,V100_UNIT_IDS.NAO);assert.equal(duplicate.applied,false);assert.equal(duplicate.reason,'already-owned');assert.deepEqual(duplicate.save,old);
});
