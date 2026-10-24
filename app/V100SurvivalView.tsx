"use client";

import { useState } from "react";
import { AshfallGame, type UnitKind, type AshfallExternalSession } from "./AshfallGame";
import { applyV100SaveMutation, normalizeV100Save } from "./v100Save.js";
import { v100SurvivalBossPool, v100SurvivalSession } from "./v100Survival.js";
import { beginV100Survival, checkpointV100Survival, selectV100SurvivalUpgrade, settleV100Survival, dismissV100SurvivalResult } from "./v100SurvivalTransactions.js";
import { v100EquipmentFor } from "./v100Equipment.js";
import { V100_UNITS } from "./v100Registry.js";

type Save = ReturnType<typeof normalizeV100Save>;
type Props = { save: Save; onLoadout?: () => void; onSave: (result: { applied: boolean; save: Save; reason?: string }) => Promise<boolean> };

export function V100SurvivalView({ save, onSave, onLoadout }: Props) {
  const [startWave, setStartWave] = useState(1);
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
  if (progress.view === "result" && result) return <section className="v100-panel v100-mode-result" data-v100-surface="survival-result" aria-label="サバイバルの戦果">
    <span className="v100-kicker">サバイバル / 戦果</span><h2>{result.endReason === "withdrawal" ? "撤退完了" : "防衛終了"}</h2>
    <dl><div><dt>到達した波</dt><dd>第{result.reachedWave}波</dd></div><div><dt>制圧した波</dt><dd>第{result.completedWave}波</dd></div><div><dt>ボス制圧</dt><dd>{result.clearedBosses}回</dd></div><div><dt>今回の獲得CAPS</dt><dd>+{result.totalCaps}</dd></div></dl>
    <p>中間記録で受け取った報酬を含みます。終了時の追加精算は {result.finalCaps} CAPSです。</p>
    {result.newHighestCompletedWave && <strong className="v100-survival-best">最高制圧記録を更新 / 第{result.completedWave}波</strong>}
    <h3>獲得した装備</h3>{result.equipmentRewardsTracked ? <p>{Object.entries(result.receivedEquipmentById).map(([id, quantity]) => `${v100EquipmentFor(id)?.displayName} ×${quantity}`).join(" / ") || "今回は追加なし（所持上限を含む）"}</p> : <p>以前のプレイは装備の獲得内訳を保存していません。</p>}
    {result.battleReport?.units.length > 0 && <details className="v100-survival-contribution"><summary>ユニットの貢献</summary><div className="v100-contribution-scroll"><table><thead><tr><th>ユニット</th><th>与ダメージ</th><th>被ダメージ</th><th>回復</th></tr></thead><tbody>{result.battleReport.units.map((unit: { unitId: string; damage: number; damageTaken: number; healing: number }) => <tr key={unit.unitId}><th>{V100_UNITS.find(member => member.id === unit.unitId)?.displayName}</th><td>{Math.round(unit.damage).toLocaleString("ja-JP")}</td><td>{Math.round(unit.damageTaken).toLocaleString("ja-JP")}</td><td>{Math.round(unit.healing).toLocaleString("ja-JP")}</td></tr>)}</tbody></table></div></details>}
    <button type="button" onClick={() => void onSave(dismissV100SurvivalResult(save))}>サバイバルへ戻る</button>
    {onLoadout && <button type="button" onClick={() => { void onSave(dismissV100SurvivalResult(save)).then(accepted => { if (accepted) onLoadout(); }); }}>編成を見直す</button>}
  </section>;
  const highestStart = Math.floor(progress.highestCompletedWave / 10) * 10 + 1;
  return <section aria-label="サバイバル" className="v100-equipment-card" data-v100-survival="hub">
    <span className="v100-kicker">サバイバル</span><h3>サバイバル</h3>
    <p>5波ごとにボスを迎撃し、報酬と中間記録を保存します。3つの強化から1つを選び、装甲車両を守り続けてください。</p>
    <p>物語で撃破したボスだけが出現します。再読み込み時は最後の中間記録から再開します。途中の未制圧の波には報酬はありません。</p>
    <p>最高制圧 {progress.highestCompletedWave}波 / 最高到達 {progress.highestReachedWave}波 / プレイ回数 {progress.totalRuns}回</p>
    {v100SurvivalBossPool(save.receipts).length === 0 ? <p>物語で初めてボスを撃破すると出撃できます。</p> : <>
      <label>開始する波 <input type="number" min={1} max={highestStart} step={10} value={startWave} onChange={event => setStartWave(Number(event.target.value))} /></label>
      <p>第1波から第{highestStart}波まで、10波刻みで開始できます。途中開始で飛ばした波の報酬はありません。</p>
      <button type="button" onClick={() => void onSave(beginV100Survival(save, { runId: `v100-survival:${crypto.randomUUID()}`, startWave }))}>サバイバルへ出撃</button>
    </>}
  </section>;
}
