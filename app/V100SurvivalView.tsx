"use client";

import { useState } from "react";
import { AshfallGame, type UnitKind, type AshfallExternalSession } from "./AshfallGame";
import { applyV100SaveMutation, normalizeV100Save } from "./v100Save.js";
import { v100SurvivalBossPool, v100SurvivalSession } from "./v100Survival.js";
import { beginV100Survival, checkpointV100Survival, selectV100SurvivalUpgrade, settleV100Survival, dismissV100SurvivalResult } from "./v100SurvivalTransactions.js";

type Save = ReturnType<typeof normalizeV100Save>;
type Props = { save: Save; onSave: (result: { applied: boolean; save: Save; reason?: string }) => Promise<boolean> };

export function V100SurvivalView({ save, onSave }: Props) {
  const [startWave, setStartWave] = useState(1);
  const [unexpected, setUnexpected] = useState(false);
  const progress = save.survival, active = progress.active;
  const session = active ? v100SurvivalSession(active, save.settings) : null;
  if (active && session) return <>
    <AshfallGame key={active.run.runId} externalSession={{ ...session,
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
    {unexpected && <div className="v100-save-retry" role="alertdialog" aria-label="防衛継続作戦の戦果確認"><div><h2>戦果の内容を確認できませんでした</h2><p>保存済みの中間記録を保持しています。再読み込みして再開してください。</p></div></div>}
  </>;
  const result = progress.lastResult;
  if (progress.view === "result" && result) return <section className="v100-panel v100-mode-result" data-v100-surface="survival-result" aria-label="防衛継続作戦の戦果">
    <span className="v100-kicker">防衛継続作戦 / 戦果</span><h2>{result.endReason === "withdrawal" ? "撤退完了" : "防衛終了"}</h2>
    <dl><div><dt>到達wave</dt><dd>{result.reachedWave}</dd></div><div><dt>制圧wave</dt><dd>{result.completedWave}</dd></div><div><dt>ボス制圧</dt><dd>{result.clearedBosses}回</dd></div><div><dt>この作戦の獲得CAPS</dt><dd>+{result.totalCaps}</dd></div></dl>
    <p>中間記録で受け取った報酬を含みます。終了時の追加精算は {result.finalCaps} CAPSです。</p>
    <button type="button" onClick={() => void onSave(dismissV100SurvivalResult(save))}>作戦一覧へ</button>
  </section>;
  const highestStart = Math.floor(progress.highestCompletedWave / 10) * 10 + 1;
  return <section aria-label="防衛継続作戦" className="v100-equipment-card" data-v100-survival="hub">
    <span className="v100-kicker">サバイバル</span><h3>防衛継続作戦</h3>
    <p>5waveごとにボスを迎撃し、報酬と中間記録を保存します。3つの強化から1つを選び、装甲車両を守り続けてください。</p>
    <p>物語で撃破したボスだけが出現します。再読み込み時は最後の中間記録から再開します。途中の未制圧waveには報酬はありません。</p>
    <p>最高制圧 {progress.highestCompletedWave}wave / 最高到達 {progress.highestReachedWave}wave / 終了した作戦 {progress.totalRuns}回</p>
    {v100SurvivalBossPool(save.receipts).length === 0 ? <p>物語で初めてボスを撃破すると出撃できます。</p> : <>
      <label>開始wave <input type="number" min={1} max={highestStart} step={10} value={startWave} onChange={event => setStartWave(Number(event.target.value))} /></label>
      <p>開始可能：1から{highestStart}まで、10wave刻み。途中開始で飛ばしたwaveの報酬はありません。</p>
      <button type="button" onClick={() => void onSave(beginV100Survival(save, { runId: `v100-survival:${crypto.randomUUID()}`, startWave }))}>防衛継続作戦へ出撃</button>
    </>}
  </section>;
}
