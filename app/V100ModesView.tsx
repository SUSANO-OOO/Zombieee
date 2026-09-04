"use client";

import { useState } from "react";
import { AshfallGame, type AshfallBattleResult } from "./AshfallGame";
import { applyV100SaveMutation, normalizeV100Save } from "./v100Save.js";
import { v100OutbreakEncounters } from "./v100Outbreak.js";
import { v100EquipmentFor, v100EquipmentQuantityCap } from "./v100Equipment.js";
import { v100ProductionSessionFor } from "./v100BattleAdapter.js";
import { beginV100Outbreak, dismissV100OutbreakResult, leaveV100Outbreak, settleV100Outbreak } from "./v100Transactions.js";
import { V100SurvivalView } from "./V100SurvivalView";

type Save = ReturnType<typeof normalizeV100Save>;
type Encounter = { id: string; displayName: string; stageNumber: number; stageId: string; rewardCaps: number; rewardEquipment: { id: string; displayName: string } | null };
type Props = { save: Save; onBack: () => void; onLoadout: () => void; onSave: (result: { applied: boolean; save: Save; reason?: string }) => Promise<boolean> };
const runId = () => `v100-outbreak:${crypto.randomUUID()}`;

export function V100ModesView({ save, onBack, onLoadout, onSave }: Props) {
  const [tab, setTab] = useState<"outbreak" | "survival" | "compendium" | "records">("outbreak");
  const [unsaved, setUnsaved] = useState<AshfallBattleResult | null>(null);
  const bosses: Encounter[] = v100OutbreakEncounters(save);
  const defeatCounts: Record<string, number> = save.bosses.defeatCounts;
  const active = save.outbreak.active;
  const activeBoss = bosses.find(boss => boss.id === active?.bossId);
  const session = active && activeBoss ? v100ProductionSessionFor({ save, stageId: activeBoss.stageId, resultId: active.runId }) : null;
  const settle = async (result: AshfallBattleResult) => {
    const change = settleV100Outbreak(save, result);
    if (!change.applied || !await onSave(change)) { setUnsaved(result); return; }
    setUnsaved(null);
  };
  if (save.survival.view !== "hub") return <V100SurvivalView save={save} onSave={onSave} />;
  if (session && active) return <>
    <AshfallGame key={active.runId} externalSession={{ ...session,
      onBattleResult: settle,
      onBattleAction: async action => {
        if (unsaved) return false;
        const accepted = await onSave(leaveV100Outbreak(save, { runId: active.runId, restartRunId: action === "restart" ? runId() : null }));
        if (accepted && action === "loadout") onLoadout();
        return accepted;
      },
      onSettingsChange: async settings => {
        if (unsaved) return false;
        return onSave(applyV100SaveMutation(save, (draft: Save) => ({ ...draft, settings: { ...draft.settings, ...settings } })));
      },
    }} />
    {unsaved && <div className="v100-save-retry" role="alertdialog" aria-label="異常発生の戦果保存"><div><h2>戦果を保存できませんでした</h2><p>この画面で戦果を保持しています。保存完了後に報酬を受け取れます。</p><button type="button" onClick={() => void settle(unsaved)}>戦果の保存を再試行</button></div></div>}
  </>;
  const result = save.outbreak.lastResult;
  if (save.outbreak.view === "result" && result) return <section className="v100-panel v100-mode-result" data-v100-surface="outbreak-result" aria-label="異常発生の戦果">
    <span className="v100-kicker">異常発生 / 戦果</span><h2>{result.won ? "再制圧成功" : "作戦失敗"}</h2>
    <h3>{bosses.find(boss => boss.id === result.bossId)?.displayName}</h3>
    <dl><div><dt>獲得CAPS</dt><dd>+{result.rewardCaps}</dd></div><div><dt>装甲車両</dt><dd>{result.vehicleHp} / {result.vehicleMaxHp}</dd></div><div><dt>経過時間</dt><dd>{result.elapsedSeconds}秒</dd></div><div><dt>装備</dt><dd>{v100EquipmentFor(result.grantedEquipmentId)?.displayName ?? "なし"}</dd></div></dl>
    <button type="button" onClick={() => void onSave(dismissV100OutbreakResult(save))}>異常発生一覧へ</button>
  </section>;
  return <section className="v100-panel v100-modes-screen" data-v100-surface="modes" aria-label="異常発生・記録">
    <div className="v100-panel-heading"><div><span className="v100-kicker">作戦地図</span><h2>異常発生・記録</h2></div><button type="button" onClick={onBack}>作戦地図へ</button></div>
    <nav className="v100-equipment-tabs" aria-label="記録の種類">{([ ["outbreak", "異常発生"], ["survival", "サバイバル"], ["compendium", "ボス図鑑"], ["records", "戦績"] ] as const).map(([id, name]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{name}</button>)}</nav>
    {tab === "survival" && <V100SurvivalView save={save} onSave={onSave} />}
    {tab === "outbreak" && <p>物語で撃破した異常個体との再戦です。現在の編成・装備で出撃します。</p>}
    {tab === "records" && <div className="v100-mode-totals"><span>物語制圧 {save.completedStageIds.length} / 30</span><span>獲得した星 {Object.values(save.bestStars).reduce((sum: number, value) => sum + Number(value), 0)}</span><span>所持 {save.caps} CAPS</span></div>}
    {tab !== "survival" && bosses.length === 0 && <p>物語で初めて撃破した異常個体が、ここに記録されます。</p>}
    {tab !== "survival" && <div className="v100-equipment-catalog">{bosses.map(boss => {
      const item = boss.rewardEquipment;
      const rewardOwned = item && (save.equipment.inventory[item.id] ?? 0) >= v100EquipmentQuantityCap(item.id);
      const clears = save.outbreak.clearCounts[boss.id] ?? 0;
      return <article className="v100-equipment-card" key={boss.id} data-outbreak-boss-id={boss.id}>
        <span className="v100-kicker">物語 第{boss.stageNumber}作戦 / 撃破済み</span><h3>{boss.displayName}</h3>
        <p>総撃破 {defeatCounts[boss.id] ?? 0}回 / 異常発生制圧 {clears}回 / サバイバル制圧 {save.survival.clearCounts[boss.id] ?? 0}回</p>
        {tab === "outbreak" && <><p>制圧報酬 {boss.rewardCaps} CAPS</p><p>初回装備：{item?.displayName ?? "なし"}{clears > 0 ? "（初回制圧済み）" : rewardOwned ? "（所持上限のため追加なし）" : ""}</p><button type="button" onClick={() => void onSave(beginV100Outbreak(save, boss.id, { runId: runId() }))}>この異常個体と再戦</button></>}
        {tab === "compendium" && <p>物語での撃破後、異常発生に出現します。個別の撃破記録は全モードで共有します。</p>}
      </article>;
    })}</div>}
  </section>;
}
