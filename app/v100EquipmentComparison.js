import {aggregateEquipmentEffects} from './equipment.js';
import {normalizeV100Equipment,v100EquipmentFor,v100OpeningSupportGauge,v100EquipmentSnapshot} from './v100Equipment.js';
import {v100UnitPresentation,formatV100Number} from './v100UnitPresentation.js';

const fields=[['hp','HP','',false],['damage','通常攻撃','',false],['defense','ダメージ軽減','%',false],
  ['attackEvery','攻撃間隔','秒',true],['range','射程','',false],['speed','移動速度','',false],
  ['healing','通常治療',' HP',false],['deployCooldown','再出撃の待ち時間','秒',true]];

/** Read-only fitting: an extra copy is simulated, never taken from another ally. */
export function v100EquipmentComparison(save,{unitId,itemId,slot=0}={}){
 const item=v100EquipmentFor(itemId);
 if(!item||!save?.ownedUnitIds?.includes(unitId)||![0,1].includes(slot))return null;
 const equipment=normalizeV100Equipment(save.equipment,save.ownedUnitIds);
 const personal=item.slotType==='personal';
 const slots=personal?equipment.personalByUnit[unitId]??[null,null]:equipment.tacticalIds;
 const oldId=slots[slot],alreadyEquipped=oldId===itemId,otherSlot=slots[1-slot]===itemId;
 const used=[...Object.values(equipment.personalByUnit).flat(),...equipment.tacticalIds].filter(id=>id===itemId).length;
 const quantity=equipment.inventory[itemId]??0,spare=Math.max(0,quantity-used);
 const current=v100UnitPresentation(save,unitId);
 const preview=structuredClone(equipment);
 if(!alreadyEquipped&&!otherSlot){
  preview.inventory[itemId]=Math.max(quantity,used+1);
  if(personal){preview.personalByUnit[unitId]=[...slots];preview.personalByUnit[unitId][slot]=itemId;}
  else preview.tacticalIds[slot]=itemId;
 }
 const nextSave={...save,equipment:preview},next=v100UnitPresentation(nextSave,unitId);
 const changes=[];
 const add=(key,label,before,after,suffix='',lowerBetter=false)=>{
  if(Math.abs(before-after)<1e-9)return;
  changes.push({key,label,before,after,beforeLabel:formatV100Number(before)+suffix,afterLabel:formatV100Number(after)+suffix,improved:lowerBetter?after<before:after>before});
 };
 for(const [key,label,suffix,lowerBetter]of fields){
  if(key==='damage'&&current.current.healing>0)continue;
  const scale=key==='defense'?100:1;
  add(key,label,current.current[key]*scale,next.current[key]*scale,suffix,lowerBetter);
 }
 if(!personal){
  const beforeSnapshot=v100EquipmentSnapshot(save),afterSnapshot=v100EquipmentSnapshot(nextSave);
  add('support','開幕の支援',v100OpeningSupportGauge(beforeSnapshot),v100OpeningSupportGauge(afterSnapshot));
  const before=aggregateEquipmentEffects(beforeSnapshot.tacticalEquipmentIds,beforeSnapshot.equipmentEnhancementLevels);
  const after=aggregateEquipmentEffects(afterSnapshot.tacticalEquipmentIds,afterSnapshot.equipmentEnhancementLevels);
  add('energy','開幕の指揮への上乗せ',before.startingEnergyFlat,after.startingEnergyFlat);
 }
 return {unitId,itemId,slot,current,next,changes,quantity,spare,alreadyEquipped,otherSlot,
  replacedName:v100EquipmentFor(oldId)?.displayName??'装備なし',canEquip:!alreadyEquipped&&!otherSlot&&spare>0,
  reason:alreadyEquipped?'この枠に装備中':otherSlot?`枠${2-slot}に装備中`:quantity===0?'購入すると装備できます':spare===0?'所持分はほかの仲間が装備中':null};
}
