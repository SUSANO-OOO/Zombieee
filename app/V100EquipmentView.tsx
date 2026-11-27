"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { V100_UNITS } from "./v100Registry.js";
import { V100_EQUIPMENT_CATALOG, v100EquipmentQuantityCap, v100EquipmentPurchaseUnlocked, normalizeV100Equipment } from "./v100Equipment.js";
import { equipmentEffectSummary, equipmentEnhancementCost, EQUIPMENT_MAX_ENHANCEMENT, EQUIPMENT_BY_ID } from "./equipment.js";
import { formatV100Number, v100UnitPresentation } from "./v100UnitPresentation.js";
import { V100LockChain } from "./V100LockChain";
import { V100_PREPARATION_ART } from "./v100PreparationArt.js";
import { v100EquipmentArtworkImgStyle } from "./v100EquipmentArt.js";
import { v100EquipmentComparison } from "./v100EquipmentComparison.js";
import "./v100EquipmentComparison.css";

type Equipment = ReturnType<typeof normalizeV100Equipment>;
type Item = { id: string; displayName: string; slotType: string; source: string; purchaseCaps: number | null; unlockStageNumber: number; artCell: number };
const ITEMS: readonly Item[] = V100_EQUIPMENT_CATALOG;
const UNITS: readonly { id: string; displayName: string }[] = V100_UNITS;
type Props = {
  save: { caps: number; ownedUnitIds: string[]; completedStageIds: string[]; equipment: Equipment; unitLevels?: Record<string, number>; levelCap?: number };
  notice: string;
  saving: boolean;
  onBack: () => void;
  onPurchase: (id: string, quantity: number) => void;
  onUpgrade: (id: string, level: number) => void;
  onEquip: (unitId: string | null, slot: number, id: string | null) => void;
};

function EquipmentArt({ item, locked = false }: { item: Item; locked?: boolean }) {
  return <span className="v100-equipment-art" aria-hidden="true"><img src={V100_PREPARATION_ART.equipment} alt="" style={v100EquipmentArtworkImgStyle(item)} />{locked && <V100LockChain />}</span>;
}

function EmptyEquipmentRack({ tab, save, onBrowse }: { tab: "personal" | "tactical" | "shop"; save: Props["save"]; onBrowse: (id?: string) => void }) {
  const kind = tab === "tactical" ? "部隊装備" : "個人装備";
  const examples = ITEMS.filter(entry => entry.slotType === tab && entry.source === "supply-shop").slice(0, 2);
  return <div className="v100-equipment-empty-rack">
    <header><strong>{kind}は未所持</strong><span>補給品から選ぶ</span></header>
    <div className="v100-equipment-empty-examples" aria-label={kind + "の補給品"}>{examples.map(entry => {
      const unlocked = v100EquipmentPurchaseUnlocked(save, entry.id);
      return <button type="button" key={entry.id} aria-label={entry.displayName + "を補給所で見る"} onClick={() => onBrowse(entry.id)}>
        <EquipmentArt item={entry} locked={!unlocked} /><span><strong>{entry.displayName}</strong><small>{unlocked ? entry.purchaseCaps + " CAPS" : "S" + String(entry.unlockStageNumber).padStart(2, "0") + "クリアで解放"}</small></span>
      </button>;
    })}</div>
    <button type="button" className="v100-equipment-open-supply" onClick={() => onBrowse()}>補給所で装備を探す</button>
  </div>;
}

export function V100EquipmentView({ save, notice, saving, onBack, onPurchase, onUpgrade, onEquip }: Props) {
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
  const slotType = tab === "shop" ? item?.slotType : tab;
  const slots = slotType === "personal" ? equipment.personalByUnit[selectedUnit] ?? [null, null] : equipment.tacticalIds;
  const quantity = item ? equipment.inventory[item.id] ?? 0 : 0;
  const level = item ? equipment.enhancementLevels[item.id] ?? 0 : 0;
  const cost = item ? equipmentEnhancementCost(item.id, level) : null;
  const unlocked = item && v100EquipmentPurchaseUnlocked(save, item.id);
  const atCap = item && quantity >= v100EquipmentQuantityCap(item.id);
  const selectedPresentation = selectedUnit ? v100UnitPresentation(save, selectedUnit) : null;
  const healingItem = item && Boolean(EQUIPMENT_BY_ID[item.id]?.effect?.healingMultiplier);
  const comparison = item ? v100EquipmentComparison(save, {unitId:selectedUnit,itemId:item.id,slot:previewSlot}) : null;
  const price = item?.purchaseCaps;
  const canBuyHere = item?.source === "supply-shop" && price != null;
  const purchaseButton = canBuyHere && <button type="button" className="v100-primary" data-ui-sound="transaction"
    disabled={saving || !unlocked || atCap || save.caps < price} onClick={() => onPurchase(item.id, quantity)}>
    {!unlocked ? "未解放" : atCap ? "所持上限" : save.caps < price ? `あと ${price - save.caps} CAPS必要` : `${price} CAPSで購入`}
  </button>;
  const needsCopy = comparison && !comparison.spare && !comparison.alreadyEquipped && !comparison.otherSlot;
  const noStatChange = healingItem && selectedUnit !== "unit-nao" ? "治療の回復量が増えるのはナオのみ。" : "この仲間の戦闘能力は変わりません。";
  return <section className="v100-panel v100-equipment-screen v100-command-equipment" data-v100-surface="equipment" data-equipment-tab={tab} aria-label="ユニット・部隊装備">
    <div className="v100-panel-heading"><nav className="v100-equipment-tabs" aria-label="装備の種類">{([
      ["personal", "個人装備"], ["tactical", "部隊装備"], ["shop", "補給所"],
    ] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav><button type="button" onClick={onBack}>支援へ</button></div>
    {tab !== "shop" && <div className="v100-equipment-assignment">
      {tab === "personal" ? <label>装備する仲間<select value={selectedUnit} onChange={event => setUnitId(event.target.value)}>{UNITS.filter(unit => save.ownedUnitIds.includes(unit.id)).map(unit => <option key={unit.id} value={unit.id}>{unit.displayName}</option>)}</select></label> : <span>部隊全員に効果 / 2枠</span>}
      {[0, 1].map(slot => <label key={slot}>枠 {slot + 1}<select aria-label={`装備枠 ${slot + 1}`} value={slots[slot] ?? ""} onChange={event => onEquip(tab === "personal" ? selectedUnit : null, slot, event.target.value || null)}>
        <option value="">装備なし</option>{items.map(entry => <option key={entry.id} value={entry.id}>{entry.displayName}</option>)}
      </select></label>)}
    </div>}
    <div className="v100-equipment-workspace"><div className="v100-supply-index"><div className="v100-supply-heading"><strong>{tab === "shop" ? "補給品一覧" : tab === "personal" ? "個人の装備品" : "部隊の装備品"}</strong><span>所持 {save.caps} CAPS</span></div><div className="v100-equipment-catalog" aria-label="装備一覧" data-empty={items.length === 0}>
      {items.length === 0 && <EmptyEquipmentRack tab={tab} save={save} onBrowse={id => { if (id) setSelectedId(id); setTab("shop"); }} />}
      {items.map(entry => {const owned=equipment.inventory[entry.id]??0,locked=tab==="shop"&&!v100EquipmentPurchaseUnlocked(save,entry.id);return <button type="button" className={`v100-equipment-card ${entry.id===item?.id?"selected":""}`} key={entry.id} data-equipment-id={entry.id} aria-pressed={entry.id===item?.id} onClick={()=>setSelectedId(entry.id)}>
        <EquipmentArt item={entry} locked={locked}/><span><strong>{entry.displayName}</strong><small>{locked?`S${String(entry.unlockStageNumber).padStart(2,"0")}クリアで解放`:tab==="shop"?`${entry.purchaseCaps} CAPS`:`所持 ${owned}`}</small></span>
      </button>;})}
    </div></div><aside className="v100-equipment-focus" aria-label="選択中の装備">{item ? <>
      <div className="v100-equipment-focus-body"><div className="v100-equipment-focus-heading"><div className="v100-equipment-specimen" aria-hidden="true"><EquipmentArt item={item} locked={tab==="shop"&&!unlocked}/></div><div><small>{item.slotType==="personal"?"個人装備":"部隊装備"} / 所持 {quantity}</small><h3>{item.displayName}{level>0?` ＋${level}`:""}</h3><p>{equipmentEffectSummary(item.id,level)}</p></div></div>
      {comparison && selectedPresentation && <section className="v100-equipment-quote" aria-label="装備した場合の能力" data-equipment-quote-unit={selectedUnit} data-equipment-quote-slot={previewSlot}>
        <header><strong>{item.slotType === "tactical" ? "部隊全員に効果" : "装備した場合"}</strong><span>{selectedPresentation.displayName} / 枠{previewSlot + 1}</span></header>
        <dl className="v100-equipment-quote-changes">{comparison.changes.map(change => <div key={change.key} data-stat={change.key} data-improved={change.improved}><dt>{change.label}</dt><dd><span>{change.beforeLabel}</span><span aria-hidden="true">→</span><strong>{change.afterLabel}</strong></dd></div>)}</dl>
        {comparison.changes.length === 0 && (!comparison.reason || quantity === 0) && <p className="v100-equipment-quote-neutral">{noStatChange}</p>}
        {quantity > 0 && comparison.reason && <p className="v100-equipment-quote-guide">{comparison.reason}</p>}
      </section>}
      {fittingOpen && comparison && createPortal(<div className="v100-fitting-backdrop"><section className="v100-equipment-fitting" role="dialog" aria-modal="true" aria-labelledby="v100-fitting-title">
        <header><div className="v100-fitting-heading"><EquipmentArt item={item} /><div><small>{item.slotType === "personal" ? "個人装備" : "部隊装備"}</small><h2 id="v100-fitting-title">{item.displayName}</h2></div></div><button type="button" onClick={()=>setFittingOpen(false)}>閉じる</button></header>
        <div className="v100-fitting-body" tabIndex={0} aria-label="装備を替えたときの変化"><div className="v100-fitting-person">
        <label>効果を比べる仲間<select aria-label="効果を比べる仲間" value={selectedUnit} onChange={event=>setUnitId(event.target.value)}>{UNITS.filter(unit=>save.ownedUnitIds.includes(unit.id)).map(unit=><option key={unit.id} value={unit.id}>{unit.displayName}</option>)}</select></label>
        <div className="v100-fitting-slots" aria-label="比較する装備枠">{[0,1].map(slot => {
          const equipped = ITEMS.find(entry => entry.id === slots[slot]);
          return <button type="button" key={slot} aria-pressed={previewSlot === slot} aria-label={`枠${slot + 1}と比較`}
            aria-describedby={`v100-fitting-slot-${slot}`} onClick={() => setPreviewSlot(slot)}>
            <span>枠{slot + 1}</span><strong id={`v100-fitting-slot-${slot}`}>{equipped?.displayName ?? "空き"}</strong>
          </button>;
        })}</div>
        <small>{item.slotType === "tactical" && "部隊全員に有効。数値は選んだ仲間のものです。"} 手動技の威力は含みません。</small></div>
        <div className="v100-fitting-result"><p className="v100-fitting-replacement">{comparison.replacedName} → {item.displayName}</p>
        <dl className="v100-fitting-changes">{comparison.changes.map(change=><div key={change.key} data-stat={change.key} data-improved={change.improved}><dt>{change.label}</dt><dd><span>{change.beforeLabel}</span><span aria-hidden="true">→</span><strong>{change.afterLabel}</strong></dd></div>)}</dl>
        {comparison.changes.length === 0 && !comparison.alreadyEquipped && !comparison.otherSlot && <p>{noStatChange}</p>}
        {needsCopy && quantity > 0 && <p>{comparison.reason}</p>}
        {needsCopy && canBuyHere && !unlocked && <p>第{item.unlockStageNumber}面クリアで解放</p>}
        {notice && <p role="status">{notice}</p>}
        </div></div>
        <footer>
          <span aria-live="polite">所持金 {save.caps} CAPS<br />所持 {quantity}個 / 予備 {comparison.spare}個</span>
          {needsCopy && canBuyHere ? purchaseButton : <button type="button" disabled={saving || !comparison.canEquip}
            onClick={() => onEquip(item.slotType === "personal" ? selectedUnit : null, previewSlot, item.id)}>
            {comparison.reason ?? `枠${previewSlot + 1}に装備する`}
          </button>}
        </footer>
      </section></div>,document.body)}
      <div className="v100-equipment-focus-detail">{quantity>0&&<p>{level<EQUIPMENT_MAX_ENHANCEMENT?`次の強化：${equipmentEffectSummary(item.id,level+1)}`:"最大強化済み"}</p>}{tab==="shop"&&!unlocked&&<p>S{String(item.unlockStageNumber).padStart(2,"0")}をクリアすると購入できます。</p>}{tab==="personal"&&<small>同じ装備は1人1個。別のユニットには人数分が必要です。</small>}{healingItem && <p className="v100-equipment-healing-note">ナオに装備すると、治療の回復量が増えます。ほかの仲間に装備しても、この回復量アップの効果はありません。</p>}{tab === "personal" && selectedPresentation && <p className="v100-equipment-unit-readout">{selectedPresentation.displayName} Lv.{selectedPresentation.level} / 現在の装備込み<br />HP <strong>{selectedPresentation.current.hp}</strong> / 防御 <strong>{(selectedPresentation.current.defense * 100).toFixed(2)}%</strong>{selectedPresentation.current.healing > 0 && <> / 回復量（HP/回） <strong>{formatV100Number(selectedPresentation.current.healing)}</strong></>}</p>}</div>
      </div><div className="v100-equipment-focus-actions">
        {tab==="shop"&&<p className="v100-equipment-price" aria-label="必要CAPSと不足額">所持 {save.caps} CAPS{item.purchaseCaps !== null && <> / 購入 {item.purchaseCaps} CAPS{save.caps < item.purchaseCaps && <strong> / あと {item.purchaseCaps - save.caps} CAPS</strong>}</>}{quantity > 0 && cost !== null && <> / 強化 {cost} CAPS{save.caps < cost && <strong> / あと {cost - save.caps} CAPS</strong>}</>}</p>}
        {tab === "shop" && purchaseButton}
        {quantity>0&&<button type="button" disabled={cost===null||save.caps<cost} data-ui-sound="transaction" onClick={()=>onUpgrade(item.id,level)}>{cost===null?"強化上限":<>{cost} CAPSで強化{save.caps<cost&&<small>あと {cost-save.caps} CAPS必要</small>}</>}</button>}
        {comparison&&<button type="button" className="v100-open-fitting" onClick={event=>{event.currentTarget.focus();setFittingOpen(true);}}>装備を比べる</button>}
      </div>
    </>:<div className="v100-equipment-empty-brief" data-kind={tab}><small>{tab === "personal" ? "個人装備支給票" : "部隊装備支給票"}</small><h3>{tab === "personal" ? (selectedPresentation?.displayName ?? "仲間") + "の装備を整える" : "部隊全員を支える装備"}</h3><div className="v100-equipment-unfilled-slots" aria-label="未装備の2枠">{[0, 1].map(slot => <div key={slot}><strong>0{slot + 1}</strong><span>未装備</span></div>)}</div><p>{tab === "personal" ? "仲間ごとに2枠。入手した装備を割り当てられます。" : "部隊共通の2枠。装備すると全員に効果が加わります。"}</p></div>}</aside></div>
  </section>;
}
