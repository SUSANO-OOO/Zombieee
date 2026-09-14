"use client";

import { useState } from "react";
import { V100_UNITS } from "./v100Registry.js";
import { V100_EQUIPMENT_CATALOG, v100EquipmentQuantityCap, v100EquipmentPurchaseUnlocked, normalizeV100Equipment } from "./v100Equipment.js";
import { equipmentEffectSummary, equipmentEnhancementCost, EQUIPMENT_MAX_ENHANCEMENT } from "./equipment.js";
import { V100LockChain } from "./V100LockChain";
import { V100_PREPARATION_ART } from "./v100PreparationArt.js";

type Equipment = ReturnType<typeof normalizeV100Equipment>;
type Item = { id: string; displayName: string; slotType: string; source: string; purchaseCaps: number | null; unlockStageNumber: number; artCell: number };
const ITEMS: readonly Item[] = V100_EQUIPMENT_CATALOG;
const UNITS: readonly { id: string; displayName: string }[] = V100_UNITS;
type Props = {
  save: { caps: number; ownedUnitIds: string[]; completedStageIds: string[]; equipment: Equipment };
  onBack: () => void;
  onPurchase: (id: string, quantity: number) => void;
  onUpgrade: (id: string, level: number) => void;
  onEquip: (unitId: string | null, slot: number, id: string | null) => void;
};

function EquipmentArt({ item, locked = false }: { item: Item; locked?: boolean }) {
  return <span className="v100-equipment-art" aria-hidden="true"><img src={V100_PREPARATION_ART.equipment} alt="" style={{ left: `${-(item.artCell % 5) * 100}%`, top: `${-Math.floor(item.artCell / 5) * 100}%` }} />{locked && <V100LockChain />}</span>;
}

export function V100EquipmentView({ save, onBack, onPurchase, onUpgrade, onEquip }: Props) {
  const [tab, setTab] = useState<"personal" | "tactical" | "shop">(Object.keys(save.equipment.inventory).length ? "personal" : "shop");
  const [unitId, setUnitId] = useState(save.ownedUnitIds[0]);
  const [selectedId, setSelectedId] = useState(ITEMS[0].id);
  const selectedUnit = save.ownedUnitIds.includes(unitId) ? unitId : save.ownedUnitIds[0];
  const equipment = save.equipment;
  const items = ITEMS.filter(item => tab === "shop" ? item.source === "supply-shop" : item.slotType === tab && equipment.inventory[item.id] > 0);
  const item = items.find(entry => entry.id === selectedId) ?? items[0];
  const slots = tab === "personal" ? equipment.personalByUnit[selectedUnit] ?? [null, null] : equipment.tacticalIds;
  const quantity = item ? equipment.inventory[item.id] ?? 0 : 0;
  const level = item ? equipment.enhancementLevels[item.id] ?? 0 : 0;
  const cost = item ? equipmentEnhancementCost(item.id, level) : null;
  const unlocked = item && v100EquipmentPurchaseUnlocked(save, item.id);
  const atCap = item && quantity >= v100EquipmentQuantityCap(item.id);
  return <section className="v100-panel v100-equipment-screen" data-v100-surface="equipment" aria-label="隊員・部隊装備">
    <div className="v100-panel-heading"><nav className="v100-equipment-tabs" aria-label="装備の種類">{([
      ["personal", "個人装備"], ["tactical", "部隊装備"], ["shop", "補給所"],
    ] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav><button type="button" onClick={onBack}>支援へ</button></div>
    {tab !== "shop" && <div className="v100-equipment-assignment">
      {tab === "personal" ? <label>隊員<select value={selectedUnit} onChange={event => setUnitId(event.target.value)}>{UNITS.filter(unit => save.ownedUnitIds.includes(unit.id)).map(unit => <option key={unit.id} value={unit.id}>{unit.displayName}</option>)}</select></label> : <span>部隊全員に適用</span>}
      {[0, 1].map(slot => <label key={slot}>枠 {slot + 1}<select aria-label={`装備枠 ${slot + 1}`} value={slots[slot] ?? ""} onChange={event => onEquip(tab === "personal" ? selectedUnit : null, slot, event.target.value || null)}>
        <option value="">装備なし</option>{items.map(entry => <option key={entry.id} value={entry.id}>{entry.displayName}</option>)}
      </select></label>)}
    </div>}
    <div className="v100-equipment-workspace"><div className="v100-equipment-catalog" aria-label="装備一覧">
      {items.length === 0 && <p className="v100-equipment-empty">未所持です。「補給所」で装備を選べます。</p>}
      {items.map(entry => {const owned=equipment.inventory[entry.id]??0,locked=tab==="shop"&&!v100EquipmentPurchaseUnlocked(save,entry.id);return <button type="button" className={`v100-equipment-card ${entry.id===item?.id?"selected":""}`} key={entry.id} data-equipment-id={entry.id} aria-pressed={entry.id===item?.id} onClick={()=>setSelectedId(entry.id)}>
        <EquipmentArt item={entry} locked={locked}/><span><strong>{entry.displayName}</strong><small>{locked?`S${String(entry.unlockStageNumber).padStart(2,"0")}クリアで解放`:tab==="shop"?`${entry.purchaseCaps} CAPS`:`所持 ${owned}`}</small></span>
      </button>;})}
    </div><aside className="v100-equipment-focus" aria-label="選択中の装備">{item ? <>
      <div className="v100-equipment-focus-body"><div className="v100-equipment-focus-heading"><EquipmentArt item={item} locked={tab==="shop"&&!unlocked}/><div><small>{item.slotType==="personal"?"個人装備":"部隊装備"} / 所持 {quantity}</small><h3>{item.displayName}{level>0?` ＋${level}`:""}</h3><p>{equipmentEffectSummary(item.id,level)}</p></div></div>
      <div className="v100-equipment-focus-detail">{quantity>0&&<p>{level<EQUIPMENT_MAX_ENHANCEMENT?`次の強化：${equipmentEffectSummary(item.id,level+1)}`:"最大強化済み"}</p>}{tab==="shop"&&!unlocked&&<p>S{String(item.unlockStageNumber).padStart(2,"0")}をクリアすると購入できます。</p>}{tab==="personal"&&<small>同じ装備は1人1個。別の隊員には人数分が必要です。</small>}</div>
      </div><div className="v100-equipment-focus-actions">
        {tab==="shop"&&<button className="v100-primary" type="button" disabled={!unlocked||atCap||save.caps<Number(item.purchaseCaps)} data-ui-sound="transaction" onClick={()=>onPurchase(item.id,quantity)}>{!unlocked?"未解放":atCap?"所持上限":`${item.purchaseCaps} CAPSで購入`}</button>}
        {quantity>0&&<button type="button" disabled={cost===null||save.caps<cost} data-ui-sound="transaction" onClick={()=>onUpgrade(item.id,level)}>{cost===null?"強化上限":`${cost} CAPSで強化`}</button>}
      </div>
    </>:<p>装備を選択</p>}</aside></div>
  </section>;
}
