"use client";

import { useState } from "react";
import { V100_UNITS } from "./v100Registry.js";
import { V100_EQUIPMENT_CATALOG, v100EquipmentQuantityCap, normalizeV100Equipment } from "./v100Equipment.js";
import { equipmentEffectSummary, equipmentEnhancementCost, EQUIPMENT_MAX_ENHANCEMENT } from "./equipment.js";

type Equipment = ReturnType<typeof normalizeV100Equipment>;
type Item = { id: string; displayName: string; slotType: string; source: string; purchaseCaps: number | null };
const ITEMS: readonly Item[] = V100_EQUIPMENT_CATALOG;
const UNITS: readonly { id: string; displayName: string }[] = V100_UNITS;
type Props = {
  save: { caps: number; ownedUnitIds: string[]; equipment: Equipment };
  onBack: () => void;
  onPurchase: (id: string, quantity: number) => void;
  onUpgrade: (id: string, level: number) => void;
  onEquip: (unitId: string | null, slot: number, id: string | null) => void;
};

export function V100EquipmentView({ save, onBack, onPurchase, onUpgrade, onEquip }: Props) {
  const [tab, setTab] = useState<"personal" | "tactical" | "shop">("personal");
  const [unitId, setUnitId] = useState(save.ownedUnitIds[0]);
  const selectedUnit = save.ownedUnitIds.includes(unitId) ? unitId : save.ownedUnitIds[0];
  const equipment = save.equipment;
  const items = ITEMS.filter(item => tab === "shop" ? item.source === "supply-shop"
    : item.slotType === tab && equipment.inventory[item.id] > 0);
  const slots = tab === "personal" ? equipment.personalByUnit[selectedUnit] ?? [null, null] : equipment.tacticalIds;
  return <section className="v100-panel v100-equipment-screen" data-v100-surface="equipment" aria-label="隊員・部隊装備">
    <div className="v100-panel-heading"><div><span className="v100-kicker">出撃装備</span><h2>隊員・部隊装備</h2></div><button type="button" onClick={onBack}>出撃装備へ</button></div>
    <div className="v100-equipment-heading"><strong>{save.caps} CAPS</strong><span>強化は同じ種類の装備すべてに反映</span></div>
    <nav className="v100-equipment-tabs" aria-label="装備の種類">{([
      ["personal", "個人装備"], ["tactical", "部隊装備"], ["shop", "補給所"],
    ] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {tab !== "shop" && <div className="v100-equipment-assignment">
      {tab === "personal" ? <label>隊員<select value={selectedUnit} onChange={event => setUnitId(event.target.value)}>{UNITS.filter(unit => save.ownedUnitIds.includes(unit.id)).map(unit => <option key={unit.id} value={unit.id}>{unit.displayName}</option>)}</select></label> : <p>部隊全体に効果を発揮します。初期支援ゲージは85、装備込みの上限は100です。</p>}
      {[0, 1].map(slot => <label key={slot}>装備枠 {slot + 1}<select aria-label={`装備枠 ${slot + 1}`} value={slots[slot] ?? ""} onChange={event => onEquip(tab === "personal" ? selectedUnit : null, slot, event.target.value || null)}>
        <option value="">装備なし</option>{items.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}
      </select></label>)}
      <p>同じ装備は1人につき1個まで。別の隊員にも装備するには、その人数分が必要です。同じ隊員を複数枠に編成しても装備は共用します。</p>
    </div>}
    {items.length === 0 && <p className="v100-equipment-empty">この種類の装備は未所持です。補給所で購入できます。</p>}
    <div className="v100-equipment-catalog">{items.map(item => {
      const quantity = equipment.inventory[item.id] ?? 0, level = equipment.enhancementLevels[item.id] ?? 0;
      const cost = equipmentEnhancementCost(item.id, level);
      return <article className="v100-equipment-card" key={item.id} data-equipment-id={item.id}>
        <span className="v100-kicker">{item.slotType === "personal" ? "個人装備" : "部隊装備"} / 所持 {quantity}</span>
        <h3>{item.displayName} {level > 0 ? `＋${level}` : ""}</h3><p>{equipmentEffectSummary(item.id, level)}</p>
        {tab === "shop" && <button type="button" disabled={save.caps < Number(item.purchaseCaps) || quantity >= v100EquipmentQuantityCap(item.id)} onClick={() => onPurchase(item.id, quantity)}>{quantity >= v100EquipmentQuantityCap(item.id) ? "所持上限" : `${item.purchaseCaps} CAPSで購入`}</button>}
        {quantity > 0 && <><p className="v100-equipment-next">{level < EQUIPMENT_MAX_ENHANCEMENT ? `次の強化：${equipmentEffectSummary(item.id, level + 1)}` : "最大強化済み"}</p><button type="button" disabled={cost === null || save.caps < cost} onClick={() => onUpgrade(item.id, level)}>{cost === null ? "強化上限" : `${cost} CAPSで強化`}</button></>}
      </article>;
    })}</div>
  </section>;
}
