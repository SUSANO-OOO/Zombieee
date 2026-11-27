"use client";

import { useState } from "react";
import { AshfallGame, type UnitKind, type AshfallExternalSession } from "./AshfallGame";
import { applyV100SaveMutation, normalizeV100Save } from "./v100Save.js";
import { v100SurvivalBossPool, v100SurvivalSession, v100SurvivalStartChoice } from "./v100Survival.js";
import { beginV100Survival, checkpointV100Survival, selectV100SurvivalUpgrade, settleV100Survival, dismissV100SurvivalResult } from "./v100SurvivalTransactions.js";
import { v100EquipmentFor } from "./v100Equipment.js";
import { V100_UNITS } from "./v100Registry.js";
import { PRODUCTION_VISUALS } from "./productionVisuals.js";
import { SURVIVAL_END_REASONS, SURVIVAL_START_SKIP_WAVES } from "./survival.js";

type Save = ReturnType<typeof normalizeV100Save>;
type Props = { save: Save; waveInput: string; onWaveInput: (value: string) => void; onLoadout?: () => void; onSave: (result: { applied: boolean; save: Save; reason?: string }) => Promise<boolean> };

export function V100SurvivalView({ save, waveInput, onWaveInput, onSave, onLoadout }: Props) {
  const [unexpected, setUnexpected] = useState(false);
  const progress = save.survival, active = progress.active;
  const session = active ? v100SurvivalSession(active, save.settings) : null;
  const checkpoint = active?.run.phase === "upgrade-selection" ? active.run.checkpointRewards.at(-1) : null;
  if (active && session) return <>
    <AshfallGame key={active.run.runId} externalSession={{ ...session,
      survivalCheckpointReward: checkpoint && active.equipmentRewardsTracked ? { caps: checkpoint.reward.caps, equipmentText: checkpoint.reward.equipmentGrants.map((grant: { equipmentId: string; quantity: number }) => `${v100EquipmentFor(grant.equipmentId)?.displayName} ×${grant.quantity}`).join(" / ") || "追加なし（所持上限を含む）" } : undefined,
      // The persisted snapshot accepts only registered V1 unit IDs; the pure
      // adapter maps that finite registry to the exported production kinds.
      formationKinds: session.formationKinds as UnitKind[],
      selectedSupply: session.selectedSupply as AshfallExternalSession["selectedSupply"],
      onBattleResult: () => setUnexpected(true),
      onSurvivalCheckpoint: run => onSave(checkpointV100Survival(save, run)),
      onSurvivalUpgrade: id => onSave(selectV100SurvivalUpgrade(save, active.run.runId, id)),
      onSurvivalSettlement: run => onSave(settleV100Survival(save, run)),
      onSettingsChange: settings => onSave(applyV100SaveMutation(save, (draft: Save) => ({ ...draft, settings: { ...draft.settings, ...settings } }))),
    }} />
    {unexpected && <div className="v100-save-retry" role="alertdialog" aria-label="サバイバルの戦果確認"><div><h2>戦果の内容を確認できませんでした</h2><p>保存済みの中間記録を保持しています。再読み込みして再開してください。</p></div></div>}
  </>;
  const result = progress.lastResult;
  if (progress.view === "result" && result) {
    const title = {
      [SURVIVAL_END_REASONS.WITHDRAWAL]: "撤退完了",
      [SURVIVAL_END_REASONS.CRAWLER_DESTROYED]: "装甲車大破",
      [SURVIVAL_END_REASONS.SQUAD_DEFEATED]: "部隊全滅",
    }[result.endReason] ?? "防衛終了";
    return <section className="v100-mode-result v100-survival-debrief" data-v100-surface="survival-result" aria-label="サバイバルの戦果">
      <header className="v100-survival-debrief-scene">
        <img src={PRODUCTION_VISUALS.stages["stage-nishijin-shopping-street"]} alt="" />
        <div><span>サバイバル</span><h2>{title}</h2><p>{result.reachedWave >= (result.startWave ?? 1) ? `第${result.reachedWave}波に到達` : "開戦前"}</p></div>
      </header>
      <div className="v100-survival-debrief-record">
        <dl>
          {result.startWave !== undefined && <div><dt>突破した波</dt><dd>{Math.max(0, result.completedWave - result.startWave + 1)}波</dd></div>}
          <div><dt>敵撃破</dt><dd>{result.kills}体</dd></div>
          <div><dt>ボス撃破</dt><dd>{result.clearedBosses}体</dd></div>
          <div><dt>獲得CAPS</dt><dd>+{result.totalCaps}</dd></div>
        </dl>
        {result.totalCaps > result.finalCaps && <p>うち {result.totalCaps - result.finalCaps} CAPSはボス撃破時に獲得</p>}
        {result.newHighestCompletedWave && <strong>新記録！　第{result.completedWave}波突破</strong>}
        <p><b>装備報酬</b>　{result.equipmentRewardsTracked ? Object.entries(result.receivedEquipmentById).map(([id, quantity]) => `${v100EquipmentFor(id)?.displayName} ×${quantity}`).join(" / ") || "なし" : "記録なし"}</p>
      </div>
      <footer>
        {result.startWave !== undefined && <button className="v100-survival-retry" type="button" onClick={() => void onSave(beginV100Survival(save, {
          runId: `v100-survival:${crypto.randomUUID()}`, retryOf: result.runId, startWave: result.startWave,
        }))}>第{result.startWave}波から再挑戦</button>}
        {onLoadout && <button type="button" onClick={() => { void onSave(dismissV100SurvivalResult(save)).then(accepted => { if (accepted) onLoadout(); }); }}>編成を見直す</button>}
        <button type="button" onClick={() => void onSave(dismissV100SurvivalResult(save))}>出撃準備へ</button>
      </footer>
      {result.battleReport?.units.length > 0 && <details className="v100-survival-contribution"><summary>ユニット別の戦績</summary><div className="v100-contribution-scroll"><table><thead><tr><th>ユニット</th><th>与ダメージ</th><th>被ダメージ</th><th>回復</th></tr></thead><tbody>{result.battleReport.units.map((unit: { unitId: string; damage: number; damageTaken: number; healing: number }) => <tr key={unit.unitId}><th>{V100_UNITS.find(member => member.id === unit.unitId)?.displayName}</th><td>{Math.round(unit.damage).toLocaleString("ja-JP")}</td><td>{Math.round(unit.damageTaken).toLocaleString("ja-JP")}</td><td>{Math.round(unit.healing).toLocaleString("ja-JP")}</td></tr>)}</tbody></table></div></details>}
    </section>;
  }
  const { highestStart, startWave, validStart } = v100SurvivalStartChoice(waveInput, progress.highestCompletedWave);
  // A step from a mistyped value goes to the next valid starting point in that direction.
  const stepIndex = (startWave - 1) / SURVIVAL_START_SKIP_WAVES;
  const previousStart = Math.max(1, Math.min(highestStart, 1 + (Math.ceil(stepIndex) - 1) * SURVIVAL_START_SKIP_WAVES));
  const nextStart = Math.max(1, Math.min(highestStart, 1 + (Math.floor(stepIndex) + 1) * SURVIVAL_START_SKIP_WAVES));
  return <section aria-label="サバイバル" className="v100-survival-preparation" data-v100-survival="hub">
  <div className="v100-survival-watch">
    <div className="v100-survival-place" aria-hidden="true">
      <img className="v100-survival-place-photo" src={PRODUCTION_VISUALS.stages["stage-nishijin-shopping-street"]} alt="" />
      <img className="v100-survival-vehicle" src="/art/v075/crawler/crawler-command-base-closed-v1.png" alt="" />
    </div>
    <h3>装甲車両を守り続ける</h3>
    <dl className="v100-survival-records">
      <div><dt>最高記録</dt><dd>{progress.highestCompletedWave}<small>波</small></dd></div>
      <div><dt>最高到達</dt><dd>{progress.highestReachedWave}<small>波</small></dd></div>
      <div><dt>プレイ回数</dt><dd>{progress.totalRuns}<small>回</small></dd></div>
    </dl>
  </div>
  <div className="v100-survival-plan">
    {v100SurvivalBossPool(save.receipts).length === 0
      ? <p className="v100-survival-locked">物語で初めてボスを撃破すると出撃できます。</p>
      : <>
        <div className="v100-survival-departure">
          {highestStart === 1
            ? <div className="v100-survival-fixed-start"><span>開始地点</span><strong>第1波</strong></div>
            : <div className="v100-survival-wave-picker">
              <label htmlFor="v100-start-wave">開始する波</label>
              <div className="v100-survival-wave-controls">
                <button type="button" aria-label="前の開始地点" disabled={startWave === previousStart} onClick={() => onWaveInput(String(previousStart))}>−</button>
                <input id="v100-start-wave" type="number" inputMode="numeric" min={1} max={highestStart} step={SURVIVAL_START_SKIP_WAVES}
                  value={waveInput} aria-invalid={!validStart} aria-describedby={validStart ? undefined : "v100-start-wave-hint"} onChange={event => onWaveInput(event.target.value)} />
                <button type="button" aria-label="次の開始地点" disabled={startWave === nextStart} onClick={() => onWaveInput(String(nextStart))}>＋</button>
              </div>
            </div>}
          <button type="button" disabled={!validStart} onClick={async () => {
            const started = await onSave(beginV100Survival(save, { runId: `v100-survival:${crypto.randomUUID()}`, startWave }));
            if (started) onWaveInput("1");
          }}>サバイバルへ出撃</button>
        </div>
        {!validStart && <p id="v100-start-wave-hint" className="v100-survival-wave-hint" role="status">第1波から10波刻みで選べます。現在は第{highestStart}波まで。</p>}
        <p className="v100-survival-start-note">{highestStart === 1 ? "第10波をクリアすると、第11波からも出撃できます。" : "途中の波から始めると、飛ばした波の報酬はもらえません。"}</p>
      </>}
    <ol className="v100-survival-cycle" aria-label="サバイバルの流れ">
      <li><strong>5波ごとにボスを迎撃</strong><span>物語で撃破したボスだけが出現します。</span></li>
      <li><strong>ボスの波をクリアすると自動セーブ</strong><span>ボスと残りの敵をすべて倒すと、報酬が手に入ります。</span></li>
      <li><strong>3つの強化から1つ選んで、次の波へ</strong></li>
    </ol>
    {v100SurvivalBossPool(save.receipts).includes("kurome") && <p className="v100-survival-danger">第16波から、感染群に湾岸の異形が1体ずつ加わります。</p>}
    {v100SurvivalBossPool(save.receipts).includes("futago") && <p className="v100-survival-danger">第21波から、RED PANTHERの兵士も1人ずつ現れます。</p>}
  </div>
</section>;
}
