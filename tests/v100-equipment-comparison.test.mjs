import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultV100Save,normalizeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {V100_EQUIPMENT_CATALOG} from '../app/v100Equipment.js';
import {v100EquipmentComparison} from '../app/v100EquipmentComparison.js';
import {v100UnitPresentation} from '../app/v100UnitPresentation.js';
import {equipV100Equipment} from '../app/v100Transactions.js';
const fixture=()=>normalizeV100Save({...createDefaultV100Save(),caps:20000,ownedUnitIds:V100_UNITS.map(u=>u.id),completedStageIds:V100_STAGE_IDS,levelCap:30,unitLevels:{'unit-nao':12,'unit-paisen':8}});
test('all 19 equipment quotes match actual equip transactions for all 16 allies, both slots and enhancement endpoints',()=>{
 for(const item of V100_EQUIPMENT_CATALOG)for(const unit of V100_UNITS)for(const slot of [0,1])for(const level of [0,5]){
  const save=fixture();save.equipment.inventory[item.id]=1;save.equipment.enhancementLevels[item.id]=level;
  const original=structuredClone(save),quote=v100EquipmentComparison(save,{unitId:unit.id,itemId:item.id,slot});
  const result=equipV100Equipment(save,{unitId:item.slotType==='personal'?unit.id:null,equipmentId:item.id,slot});
  assert.equal(result.applied,true);assert.equal(quote.canEquip,true);
  assert.deepEqual(quote.next.current,v100UnitPresentation(result.save,unit.id).current,item.id+':'+unit.id);
  assert.deepEqual(save,original,'fitting must not change save, CAPS, receipts, ownership or allocations');
 }
});
test('purchase preview and insufficient spare copies never steal another ally equipment',()=>{
 const save=fixture();const before=structuredClone(save);
 const empty=v100EquipmentComparison(save,{unitId:'unit-paisen',itemId:'reinforced-vest'});
 assert.equal(empty.canEquip,false);assert.ok(empty.next.current.hp>empty.current.current.hp);assert.deepEqual(save,before);
 save.equipment.inventory['reinforced-vest']=1;save.equipment.personalByUnit['unit-hachi']=['reinforced-vest',null];
 const used=v100EquipmentComparison(save,{unitId:'unit-paisen',itemId:'reinforced-vest'});
 assert.equal(used.canEquip,false);assert.equal(used.spare,0);assert.ok(used.next.current.hp>used.current.current.hp);
 assert.equal(save.equipment.personalByUnit['unit-hachi'][0],'reinforced-vest');
});
test('replacing a vest with a weapon shows lost HP as well as gained attack; duplicate gear is unavailable',()=>{
 let save=fixture();save.equipment.inventory={'reinforced-vest':1,'field-machete':2};
 save=equipV100Equipment(save,{unitId:'unit-paisen',equipmentId:'reinforced-vest',slot:0}).save;
 const quote=v100EquipmentComparison(save,{unitId:'unit-paisen',itemId:'field-machete',slot:0});
 assert.equal(quote.changes.find(r=>r.key==='hp').improved,false);assert.equal(quote.changes.find(r=>r.key==='damage').improved,true);
 save=equipV100Equipment(save,{unitId:'unit-paisen',equipmentId:'field-machete',slot:1}).save;
 assert.equal(v100EquipmentComparison(save,{unitId:'unit-paisen',itemId:'field-machete',slot:0}).otherSlot,true);
 assert.equal(v100EquipmentComparison(save,{unitId:'unit-paisen',itemId:'field-machete',slot:1}).alreadyEquipped,true);
});
test('treatment gear has no invented benefit for a fighter, and tactical opening support is shown',()=>{
 const save=fixture();
 assert.equal(v100EquipmentComparison(save,{unitId:'unit-paisen',itemId:'rescue-pouch'}).changes.length,0);
 assert.ok(v100EquipmentComparison(save,{unitId:'unit-nao',itemId:'rescue-pouch'}).changes.some(r=>r.key==='healing'));
 assert.ok(v100EquipmentComparison(save,{unitId:'unit-hachi',itemId:'tactical-supply-cache'}).changes.length>0);
 for(const args of [{unitId:'missing',itemId:'field-machete'},{unitId:'unit-hachi',itemId:'unknown'},{unitId:'unit-hachi',itemId:'field-machete',slot:2}])assert.equal(v100EquipmentComparison(save,args),null);
});

test('Nao can compare shooting gear without hiding damage gains behind her treatment role',()=>{
 const save=fixture();save.unitLevels['unit-nao']=1;
 save.equipment.inventory={'field-machete':1,'rescue-pouch':1};
 const before=structuredClone(save);
 const weapon=v100EquipmentComparison(save,{unitId:'unit-nao',itemId:'field-machete'});
 const equipped=equipV100Equipment(save,{unitId:'unit-nao',equipmentId:'field-machete',slot:0});
 assert.equal(equipped.applied,true);
 const damage=weapon.changes.find(change=>change.key==='damage');
 assert.ok(damage,'Nao shoots normally when no ally needs treatment; her weapon gain must be visible');
 assert.equal(damage.before,weapon.current.current.damage);
 assert.equal(damage.after,v100UnitPresentation(equipped.save,'unit-nao').current.damage);
 assert.ok(damage.after>damage.before);assert.equal(damage.improved,true);
 assert.equal(weapon.next.current.healing,weapon.current.current.healing);
 assert.equal(weapon.changes.some(change=>change.key==='healing'),false);
 const treatment=v100EquipmentComparison(save,{unitId:'unit-nao',itemId:'rescue-pouch'});
 assert.ok(treatment.changes.some(change=>change.key==='healing'&&change.improved));
 assert.equal(treatment.changes.some(change=>change.key==='damage'),false);
 assert.deepEqual(save,before,'both comparisons remain read-only');
});

test('a shared treatment upgrade and its removal show Nao’s actual healing when viewing a different ally',()=>{
 const save=fixture(),unitId='unit-hachi',itemId='tactical-trauma-station';
 save.equipment.inventory={[itemId]:1,'tactical-field-radio':1};
 const withStation=equipV100Equipment(save,{unitId:null,equipmentId:itemId,slot:0}).save;
 const before=v100UnitPresentation(save,'unit-nao').current.healing;
 const after=v100UnitPresentation(withStation,'unit-nao').current.healing;
 const quote=v100EquipmentComparison(save,{unitId,itemId});
 const change=quote.changes.find(row=>row.key==='team-healing');
 assert.equal(change.before,before);assert.equal(change.after,after);
 assert.equal(change.label,'ナオの通常治療');assert.ok(change.improved);
 assert.equal(quote.current.current.healing,0);assert.equal(quote.next.current.healing,0);
 assert.deepEqual(quote.changes.map(row=>row.key),['team-healing']);
 const replacement=v100EquipmentComparison(withStation,{unitId,itemId:'tactical-field-radio'});
 const loss=replacement.changes.find(row=>row.key==='team-healing');
 assert.equal(loss.before,after);assert.equal(loss.after,before);assert.equal(loss.improved,false);
 const own=v100EquipmentComparison(save,{unitId:'unit-nao',itemId});
 assert.deepEqual(own.changes.map(row=>row.key),['healing']);
 const withoutMedic={...save,ownedUnitIds:save.ownedUnitIds.filter(id=>id!=='unit-nao')};
 assert.equal(v100EquipmentComparison(withoutMedic,{unitId,itemId}).changes.length,0);
});
