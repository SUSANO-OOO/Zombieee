"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { V100_UNITS } from "./v100Registry.js";
import { V100_EQUIPMENT_CATALOG, v100EquipmentQuantityCap, v100EquipmentPurchaseUnlocked, normalizeV100Equipment } from "./v100Equipment.js";
import { equipmentEffectSummary, equipmentEnhancementCost, EQUIPMENT_MAX_ENHANCEMENT, EQUIPMENT_BY_ID } from "./equipment.js";
import { formatV100Number, v100UnitPresentation } from "./v100UnitPresentation.js";
import { V100LockChain } from "./V100LockChain";
import { V100_PREPARATION_ART } from "./v100PreparationArt.js";
import { v100EquipmentComparison } from "./v100EquipmentComparison.js";
import "./v100EquipmentComparison.css";

type Equipment = ReturnType<typeof normalizeV100Equipment>;
type Item = { id: string; displayName: string; slotType: string; source: string; purchaseCaps: number | null; unlockStageNumber: number; artCell: number };
const ITEMS: readonly Item[] = V100_EQUIPMENT_CATALOG;
const UNITS: readonly { id: string; displayName: string }[] = V100_UNITS;
type Props = {
  save: { caps: number; ownedUnitIds: string[]; completedStageIds: string[]; equipment: Equipment; unitLevels?: Record<string, number>; levelCap?: number };
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
  const [previewSlot, setPreviewSlot] = useState(0);
  const [fittingOpen, setFittingOpen] = useState(false);
  useEffect(()=>{
    if(!fittingOpen)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setFittingOpen(false);}};
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  },[fittingOpen]);
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
  const selectedPresentation = selectedUnit ? v100UnitPresentation(save, selectedUnit) : null;
  const healingItem = item && Boolean(EQUIPMENT_BY_ID[item.id]?.effect?.healingMultiplier);
  const comparison = item ? v100EquipmentComparison(save, {unitId:selectedUnit,itemId:item.id,slot:previewSlot}) : null;
  return <section className="v100-panel v100-equipment-screen v100-command-equipment" data-v100-surface="equipment" data-equipment-tab={tab} aria-label="ユニット・部隊装備">
    <div className="v100-panel-heading"><nav className="v100-equipment-tabs" aria-label="装備の種類">{([
      ["personal", "個人装備"], ["tactical", "部隊装備"], ["shop", "補給所"],
    ] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav><button type="button" onClick={onBack}>支援へ</button></div>
    {tab !== "shop" && <div className="v100-equipment-assignment">
      {tab === "personal" ? <label>装備するユニット<select value={selectedUnit} onChange={event => setUnitId(event.target.value)}>{UNITS.filter(unit => save.ownedUnitIds.includes(unit.id)).map(unit => <option key={unit.id} value={unit.id}>{unit.displayName}</option>)}</select></label> : <span>部隊全員に適用 / 2枠</span>}
      {[0, 1].map(slot => <label key={slot}>枠 {slot + 1}<select aria-label={`装備枠 ${slot + 1}`} value={slots[slot] ?? ""} onChange={event => onEquip(tab === "personal" ? selectedUnit : null, slot, event.target.value || null)}>
        <option value="">装備なし</option>{items.map(entry => <option key={entry.id} value={entry.id}>{entry.displayName}</option>)}
      </select></label>)}
    </div>}
    <div className="v100-equipment-workspace"><div className="v100-supply-index"><div className="v100-supply-heading"><strong>{tab === "shop" ? "補給品一覧" : tab === "personal" ? "個人の装備品" : "部隊の装備品"}</strong><span>所持 {save.caps} CAPS</span></div><div className="v100-equipment-catalog" aria-label="装備一覧">
      {items.length === 0 && <div className="v100-equipment-empty"><strong>まだ装備を持っていません</strong><p>補給所で効果を比べて、次の出撃に備えよう。</p><button type="button" onClick={()=>setTab('shop')}>補給所で装備を探す</button></div>}
      {items.map(entry => {const owned=equipment.inventory[entry.id]??0,locked=tab==="shop"&&!v100EquipmentPurchaseUnlocked(save,entry.id);return <button type="button" className={`v100-equipment-card ${entry.id===item?.id?"selected":""}`} key={entry.id} data-equipment-id={entry.id} aria-pressed={entry.id===item?.id} onClick={()=>setSelectedId(entry.id)}>
        <EquipmentArt item={entry} locked={locked}/><span><strong>{entry.displayName}</strong><small>{locked?`S${String(entry.unlockStageNumber).padStart(2,"0")}クリアで解放`:tab==="shop"?`${entry.purchaseCaps} CAPS`:`所持 ${owned}`}</small></span>
      </button>;})}
    </div></div><aside className="v100-equipment-focus" aria-label="選択中の装備">{item ? <>
      <div className="v100-equipment-focus-body"><div className="v100-equipment-focus-heading"><EquipmentArt item={item} locked={tab==="shop"&&!unlocked}/><div><small>{item.slotType==="personal"?"個人装備":"部隊装備"} / 所持 {quantity}</small><h3>{item.displayName}{level>0?` ＋${level}`:""}</h3><p>{equipmentEffectSummary(item.id,level)}</p></div></div>
      {fittingOpen && comparison && createPortal(<div className="v100-fitting-backdrop"><section className="v100-equipment-fitting" role="dialog" aria-modal="true" aria-labelledby="v100-fitting-title">
        <header><h2 id="v100-fitting-title">{item.displayName}を装備すると</h2><button type="button" onClick={()=>setFittingOpen(false)}>閉じる</button></header>
        <div className="v100-fitting-body" tabIndex={0} aria-label="装備を替えたときの変化"><div className="v100-fitting-person">
        <label>効果を比べる仲間<select aria-label="効果を比べる仲間" value={selectedUnit} onChange={event=>setUnitId(event.target.value)}>{UNITS.filter(unit=>save.ownedUnitIds.includes(unit.id)).map(unit=><option key={unit.id} value={unit.id}>{unit.displayName}</option>)}</select></label>
        <div className="v100-fitting-slots" aria-label="比較する装備枠">{[0,1].map(slot=><button type="button" key={slot} aria-pressed={previewSlot===slot} onClick={()=>setPreviewSlot(slot)}>枠{slot+1}と比較</button>)}</div>
        <small>{item.slotType==='tactical'?'部隊全員に効果があります。数値は選んだ仲間の変化です。':'今のレベル・装備から替えた場合の数値です。'} 固有技の威力は、この比較には含みません。</small></div>
        <div className="v100-fitting-result"><p className="v100-fitting-replacement">{comparison.replacedName} → {item.displayName}</p>
        <dl className="v100-fitting-changes">{comparison.changes.map(change=><div key={change.key} data-stat={change.key} data-improved={change.improved}><dt>{change.label}</dt><dd><span>{change.beforeLabel}</span><span aria-hidden="true">→</span><strong>{change.afterLabel}</strong></dd></div>)}</dl>
        {comparison.changes.length===0&&<p>{comparison.reason??'この仲間の戦闘能力は変わりません。'}</p>}
        {comparison.changes.length>0&&comparison.reason&&<p>{comparison.reason}</p>}
        </div></div><footer><span>所持 {quantity}個 / 装備に使える数 {comparison.spare}個</span>{quantity>0?<button type="button" disabled={!comparison.canEquip} onClick={()=>onEquip(item.slotType==='personal'?selectedUnit:null,previewSlot,item.id)}>{comparison.reason??`枠${previewSlot+1}に装備する`}</button>:<button type="button" onClick={()=>setFittingOpen(false)}>補給品に戻る</button>}</footer>
      </section></div>,document.body)}
      <div className="v100-equipment-focus-detail">{quantity>0&&<p>{level<EQUIPMENT_MAX_ENHANCEMENT?`次の強化：${equipmentEffectSummary(item.id,level+1)}`:"最大強化済み"}</p>}{tab==="shop"&&!unlocked&&<p>S{String(item.unlockStageNumber).padStart(2,"0")}をクリアすると購入できます。</p>}{tab==="personal"&&<small>同じ装備は1人1個。別のユニットには人数分が必要です。</small>}{healingItem && <p className="v100-equipment-healing-note">ナオに装備すると、治療の回復量が増えます。ほかの仲間に装備しても、この回復量アップの効果はありません。</p>}{tab === "personal" && selectedPresentation && <p className="v100-equipment-unit-readout">{selectedPresentation.displayName} Lv.{selectedPresentation.level} / 現在の装備込み<br />HP <strong>{selectedPresentation.current.hp}</strong> / 防御 <strong>{(selectedPresentation.current.defense * 100).toFixed(2)}%</strong>{selectedPresentation.current.healing > 0 && <> / 回復量（HP/回） <strong>{formatV100Number(selectedPresentation.current.healing)}</strong></>}</p>}</div>
      </div><div className="v100-equipment-focus-actions">
        <p className="v100-equipment-price" aria-label="必要CAPSと不足額">所持 {save.caps} CAPS{tab === "shop" && item.purchaseCaps !== null && <> / 購入 {item.purchaseCaps} CAPS{save.caps < item.purchaseCaps && <strong> / あと {item.purchaseCaps - save.caps} CAPS</strong>}</>}{quantity > 0 && cost !== null && <> / 強化 {cost} CAPS{save.caps < cost && <strong> / あと {cost - save.caps} CAPS</strong>}</>}</p>
        {tab==="shop"&&<button className="v100-primary" type="button" disabled={!unlocked||atCap||save.caps<Number(item.purchaseCaps)} data-ui-sound="transaction" onClick={()=>onPurchase(item.id,quantity)}>{!unlocked?"未解放":atCap?"所持上限":save.caps < Number(item.purchaseCaps) ? `あと ${Number(item.purchaseCaps) - save.caps} CAPS必要` : `${item.purchaseCaps} CAPSで購入`}</button>}
        {quantity>0&&<button type="button" disabled={cost===null||save.caps<cost} data-ui-sound="transaction" onClick={()=>onUpgrade(item.id,level)}>{cost===null?"強化上限":save.caps < Number(cost) ? `あと ${Number(cost) - save.caps} CAPS必要` : `${cost} CAPSで強化`}</button>}
        {comparison&&<button type="button" className="v100-open-fitting" onClick={event=>{event.currentTarget.focus();setFittingOpen(true);}}>装備を比べる</button>}
      </div>
    </>:<div className="v100-equipment-empty"><h3>次の出撃に備えよう</h3><p>補給所で装備を選ぶと、仲間の能力がどう変わるか確認できます。</p><button type="button" onClick={()=>setTab('shop')}>補給所へ</button></div>}</aside></div>
  </section>;
}
