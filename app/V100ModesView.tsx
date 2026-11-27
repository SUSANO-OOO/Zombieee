"use client";

import { useState, type CSSProperties } from "react";
import { AshfallGame, type AshfallBattleResult } from "./AshfallGame";
import { applyV100SaveMutation, normalizeV100Save } from "./v100Save.js";
import { v100OutbreakEncounters } from "./v100Outbreak.js";
import { v100EquipmentFor, v100EquipmentQuantityCap } from "./v100Equipment.js";
import { v100ProductionSessionFor } from "./v100BattleAdapter.js";
import { beginV100Outbreak, dismissV100OutbreakResult, leaveV100Outbreak, settleV100Outbreak } from "./v100Transactions.js";
import { V100SurvivalView } from "./V100SurvivalView";
import { V100_UNITS, V100_SUPPORTS } from "./v100Registry.js";
import { stageVisualFor } from "./productionVisuals.js";
import { v100BossObservationFor, bossDefinitionForId } from "./bossFoundation.js";
import { V100_BOSS_DOSSIER_ART } from "./v100BossDossierArt.js";
import { v100BasePresentationFor } from "./v100BasePresentation.js";

type Save = ReturnType<typeof normalizeV100Save>;
type Encounter = { id: string; displayName: string; stageNumber: number; stageId: string; rewardCaps: number; rewardEquipment: { id: string; displayName: string } | null };
type ModeTab = "overview" | "outbreak" | "survival" | "compendium" | "records";
type Props = { save: Save; onBack: () => void; onLoadout: (tab?: ModeTab) => void; initialTab?: ModeTab; onSave: (result: { applied: boolean; save: Save; reason?: string }) => Promise<boolean> };
const runId = () => `v100-outbreak:${crypto.randomUUID()}`;

export function V100ModesView({ save, onBack, onLoadout, onSave, initialTab = "overview" }: Props) {
  const [tab, setTab] = useState<ModeTab>(() => {
    // A restored battle or result should return to its own mode when closed.
    if (save.survival.view !== "hub") return "survival";
    if (save.outbreak.view !== "hub") return "outbreak";
    return initialTab;
  });
  const [unsaved, setUnsaved] = useState<AshfallBattleResult | null>(null);
  const bosses: Encounter[] = v100OutbreakEncounters(save);
  const defeatCounts: Record<string, number> = save.bosses.defeatCounts;
  const active = save.outbreak.active;
  const activeBoss = bosses.find(boss => boss.id === active?.bossId);
  const session = active && activeBoss ? v100ProductionSessionFor({ save, stageId: activeBoss.stageId, resultId: active.runId, battleMode: "outbreak" }) : null;
  const settle = async (result: AshfallBattleResult) => {
    const change = settleV100Outbreak(save, result);
    if (!change.applied || !await onSave(change)) { setUnsaved(result); return; }
    setUnsaved(null);
  };
  if (save.survival.view !== "hub") return <V100SurvivalView save={save} onSave={onSave} onLoadout={() => onLoadout("survival")} />;
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
    {unsaved && <div className="v100-save-retry" role="alertdialog" aria-label="異常発生の戦果保存"><div><h2>戦果を保存できませんでした</h2><p>戦闘結果をまだ保存できていません。この画面を閉じずに、もう一度保存してください。保存できると報酬を受け取れます。</p><button type="button" onClick={() => void settle(unsaved)}>もう一度保存する</button></div></div>}
  </>;
  const result = save.outbreak.lastResult;
  if (save.outbreak.view === "result" && result) {
    const boss = bosses.find(entry => entry.id === result.bossId);
    const portrait = V100_BOSS_DOSSIER_ART[result.bossId];
    const equipment = v100EquipmentFor(result.grantedEquipmentId);
    return <section className="v100-panel v100-mode-result v100-outbreak-result" data-v100-surface="outbreak-result" data-won={result.won} aria-label="異常発生の戦果">
      <header className="v100-outbreak-result-photo">
        {boss && <img src={stageVisualFor(boss.stageId)} alt="" />}
        {portrait && <span className="v100-outbreak-result-boss" aria-hidden="true" style={{ "--boss-portrait": `url("${portrait.path}")` } as CSSProperties} />}
        <div><span>異常発生</span><h2>{result.won ? "撃破" : "敗北"}</h2><h3>{boss?.displayName}</h3></div>
      </header>
      <dl className="v100-outbreak-result-stats">
        <div><dt>{v100BasePresentationFor(boss?.stageNumber).healthLabel}</dt><dd>{result.vehicleHp} <small>/ {result.vehicleMaxHp}</small></dd></div>
        <div><dt>戦闘時間</dt><dd>{Math.floor(result.elapsedSeconds / 60)}<small>分</small>{result.elapsedSeconds % 60}<small>秒</small></dd></div>
        <div><dt>獲得CAPS</dt><dd>+{result.rewardCaps}</dd></div>
        {equipment && result.grantedQuantity > 0 && <div><dt>獲得装備</dt><dd>{equipment.displayName}</dd></div>}
      </dl>
      <footer>
        <button type="button" onClick={() => void onSave(dismissV100OutbreakResult(save))}>異常発生一覧へ</button>
        {boss && <button className="v100-outbreak-fight-again" type="button" onClick={() => void onSave(beginV100Outbreak(save, boss.id, { runId: runId() }))}>{result.won ? "もう一度戦う" : "再挑戦"}</button>}
      </footer>
    </section>;
  }
  return <section className="v100-panel v100-modes-screen" data-v100-surface="modes" data-mode-tab={tab} aria-label="モード選択">
    <div className="v100-panel-heading"><h2>{tab === "overview" ? "モード選択" : tab === "outbreak" ? "異常発生" : tab === "survival" ? "サバイバル" : tab === "compendium" ? "ボス図鑑" : "戦績"}</h2><button type="button" onClick={tab === "overview" ? onBack : () => setTab("overview")}>{tab === "overview" ? "ステージ選択へ" : "モード選択へ"}</button></div>
    {tab === "overview" && <>
      <div className="v100-mode-catalog">
        <button type="button" className="v100-mode-entry v100-mode-outbreak" onClick={() => setTab("outbreak")}><span className="v100-mode-entry-copy"><strong>異常発生</strong><span>撃破済みのボスと再戦</span><small>ボスを倒すとCAPSを獲得。初回クリアでは装備も手に入ります。</small><b>{bosses.length ? `${bosses.length}体と再戦可能` : "物語でボスを撃破すると解放"}</b></span><span className="v100-mode-entry-arrow" aria-hidden="true">›</span></button>
        <button type="button" className="v100-mode-entry v100-mode-survival" onClick={() => setTab("survival")}><span className="v100-mode-entry-copy"><strong>サバイバル</strong><span>強化を選び、押し寄せる敵を迎撃</span><small>5波ごとにボス戦・報酬・中間セーブ。</small><b>{bosses.length ? (save.survival.highestCompletedWave > 0 ? `最高記録：第${save.survival.highestCompletedWave}波クリア` : "クリア記録なし") : "物語でボスを撃破すると解放"}</b></span><span className="v100-mode-entry-arrow" aria-hidden="true">›</span></button>
      </div>
      <nav className="v100-mode-record-links" aria-label="プレイ記録"><button type="button" onClick={() => setTab("compendium")}>ボス図鑑</button><button type="button" onClick={() => setTab("records")}>戦績</button></nav>
    </>}
    {(tab === "outbreak" || tab === "survival") && <aside className="v100-mode-loadout" aria-label="今回の出撃編成"><div><strong>{save.formationSlots.filter(Boolean).map((id: string) => V100_UNITS.find(unit => unit.id === id)?.displayName).join("・") || "ユニットを選んでください"}</strong><p>支援：{V100_SUPPORTS.find(support => support.id === save.equippedSupportId)?.displayName ?? "未選択"} / 装甲車両 耐久 {save.vehicle.maxHp}</p></div><button type="button" onClick={() => onLoadout(tab)}>出撃編成を変更</button></aside>}
    {tab === "survival" && <V100SurvivalView save={save} onSave={onSave} onLoadout={() => onLoadout("survival")} />}
    {tab === "outbreak" && <p className="v100-outbreak-purpose">物語で撃破した異常個体との再戦です。現在の編成・装備で出撃します。</p>}
{tab === "outbreak" && <div className="v100-outbreak-board">
  {bosses.map(boss => {
    const item = boss.rewardEquipment;
    const rewardOwned = item && (save.equipment.inventory[item.id] ?? 0) >= v100EquipmentQuantityCap(item.id);
    const clears = save.outbreak.clearCounts[boss.id] ?? 0;
    const observation = v100BossObservationFor(boss.id);
    return <article className="v100-outbreak-file" key={boss.id} data-outbreak-boss-id={boss.id}>
      <div className="v100-outbreak-location" aria-hidden="true"><img src={stageVisualFor(boss.stageId)} alt="" loading="lazy" decoding="async" /></div>
      <div className="v100-outbreak-intel">
        <span className="v100-kicker">物語 ステージ {boss.stageNumber} / 撃破済み</span>
        <h3>{boss.displayName}</h3>
        {observation && <p className="v100-outbreak-guidance">{observation}</p>}
        <dl className="v100-outbreak-reward">
          <div><dt>制圧報酬</dt><dd>{boss.rewardCaps}<small>CAPS</small></dd></div>
          <div><dt>初回装備</dt><dd>{item?.displayName ?? "なし"}<small>{clears > 0 ? "（初回制圧済み）" : rewardOwned ? "（所持上限のため追加なし）" : ""}</small></dd></div>
        </dl>
        <p className="v100-outbreak-record">総撃破 {defeatCounts[boss.id] ?? 0}回 / 異常発生制圧 {clears}回 / サバイバル制圧 {save.survival.clearCounts[boss.id] ?? 0}回</p>
        <button type="button" className="v100-outbreak-start" onClick={() => void onSave(beginV100Outbreak(save, boss.id, { runId: runId() }))}>この異常個体と再戦</button>
      </div>
    </article>;
  })}
</div>}
    {tab === "outbreak" && bosses.length === 0 && <p>物語で初めて撃破した異常個体が、ここに記録されます。</p>}
    {tab === "compendium" && <div className="v100-compendium-register">
  <p className="v100-register-intro">物語で倒したボスと、各モードでの撃破記録。</p>
  {bosses.length === 0 && <p>物語で初めて撃破した異常個体が、ここに記録されます。</p>}
  {bosses.map(boss => {
    const detail = bossDefinitionForId(boss.id === "boss-kurome" ? "boss-kurome-prototype" : boss.id);
    // V1 twins cooperate; R9 leaves Omega's large blade deliberately unclassified.
    const classification = boss.id === "boss-futago" ? "双体連携型異常発生個体"
      : boss.id === "boss-takuya-omega" ? "終端防衛型異常発生個体" : detail?.classification;
    const observation = v100BossObservationFor(boss.id);
    const total = defeatCounts[boss.id] ?? 0;
    const outbreak = save.outbreak.clearCounts[boss.id] ?? 0;
    const survival = save.survival.clearCounts[boss.id] ?? 0;
    const portraitArt = V100_BOSS_DOSSIER_ART[boss.id];
    return <article className="v100-compendium-entry" key={boss.id} data-outbreak-boss-id={boss.id}>
      <div className="v100-compendium-stage">
        <small>初遭遇</small><strong>S{String(boss.stageNumber).padStart(2, "0")}</strong>
        <span className="v100-compendium-specimen" role="img" aria-label={boss.displayName + "の姿"}
          style={portraitArt ? { "--v100-boss-dossier": `url("${portraitArt.path}")` } as CSSProperties : undefined} />
      </div>
      <div className="v100-compendium-body">
        <h3>{boss.displayName}</h3>
        {classification && <p className="v100-compendium-feature"><b>分類</b><span>{classification}</span></p>}
        {observation && <p className="v100-compendium-counter"><b>行動</b><span>{observation}</span></p>}
        <dl className="v100-compendium-history" aria-label={boss.displayName + "の撃破履歴"}>
          <div data-record-mode="total"><dt>総撃破</dt><dd>{total}<small>回</small></dd></div>
          <div data-record-mode="outbreak"><dt>異常発生</dt><dd>{outbreak}<small>回</small></dd></div>
          <div data-record-mode="survival"><dt>サバイバル</dt><dd>{survival}<small>回</small></dd></div>
        </dl>
      </div>
    </article>;
  })}
</div>}

{tab === "records" && <div className="v100-records-ledger">
  <div className="v100-records-overview">
    <section className="v100-records-story" aria-label="物語の記録">
      <h3>物語制圧</h3><p className="v100-records-progress"><strong>{save.completedStageIds.length}</strong><span>/ 30</span></p>
      <p className="v100-records-stars">獲得した星 <b>{Object.values(save.bestStars).reduce((sum: number, value) => sum + Number(value), 0)}</b></p>
    </section>
    <section className="v100-records-caps" aria-label="現在の所持CAPS"><h3>所持CAPS</h3><strong>{save.caps}</strong><span>CAPS</span></section>
  </div>
  <div className="v100-records-modes">
    <section className="v100-records-outbreak" aria-label="異常発生の記録"><h3>異常発生</h3><dl><div><dt>再制圧済み</dt><dd>{bosses.filter(boss => (save.outbreak.clearCounts[boss.id] ?? 0) > 0).length}<small>体</small></dd></div></dl></section>
    <section className="v100-records-survival" aria-label="サバイバルの記録"><h3>サバイバル</h3><dl>
      <div><dt>最高記録</dt><dd>{save.survival.highestCompletedWave}<small>波</small></dd></div>
      <div><dt>最高到達</dt><dd>{save.survival.highestReachedWave}<small>波</small></dd></div>
      <div><dt>プレイ回数</dt><dd>{save.survival.totalRuns}<small>回</small></dd></div>
    </dl></section>
  </div>
  <section className="v100-records-boss-ledger" aria-label="個体別の撃破記録">
    <h3>個体別の撃破記録</h3><p>総撃破は全モードの合計です。</p>
    {bosses.length === 0 ? <p>物語で初めて撃破した異常個体が、ここに記録されます。</p> : <table>
      <colgroup><col className="v100-record-name-col" /><col className="v100-record-total-col" /><col /><col /></colgroup>
      <thead><tr><th scope="col">個体</th><th scope="col">総撃破</th><th scope="col">異常発生</th><th scope="col">サバイバル</th></tr></thead>
      <tbody>{bosses.map(boss => <tr key={boss.id} data-outbreak-boss-id={boss.id}>
        <th scope="row">{boss.displayName}</th>
        <td data-record-mode="total">{defeatCounts[boss.id] ?? 0}<small>回</small></td>
        <td data-record-mode="outbreak">{save.outbreak.clearCounts[boss.id] ?? 0}<small>回</small></td>
        <td data-record-mode="survival">{save.survival.clearCounts[boss.id] ?? 0}<small>回</small></td>
      </tr>)}</tbody>
    </table>}
  </section>
</div>}
  </section>;
}
