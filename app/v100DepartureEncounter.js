import { selectSurvivalBossKind } from "./survivalBattleRuntime.js";
import { survivalWaveDescriptor } from "./survival.js";
import { V100_BOSSES, V100_STAGE_BY_ID } from "./v100Registry.js";
import { V100_BATTLE_ADAPTER } from "./v100BattleAdapter.js";

export function v100DepartureCrewKind(session) {
  const number = session.survivalRun?.currentWave ?? V100_STAGE_BY_ID[session.stageId]?.number ?? 1;
  return session.formationKinds[(number - 1) % Math.max(1, session.formationKinds.length)];
}

export function v100DepartureEncounter(session) {
  const run = session.survivalRun;
  if (!run) {
    const stage = V100_STAGE_BY_ID[session.stageId];
    return {
      stage,
      boss: stage && V100_BOSSES.find(boss => boss.stageNumber === stage.number),
      label: session.battleMode === "outbreak" ? "異常発生" : "出撃準備",
      number: stage && session.battleMode !== "outbreak" ? `S${String(stage.number).padStart(2, "0")}` : null,
    };
  }

  // A survival session uses the first story stage as its battlefield. The
  // asset list spans five waves and can also contain the previous boss.
  const checkpoint = run.phase === "upgrade-selection";
  const number = checkpoint ? run.lastCompletedWave : run.currentWave;
  let kind = null;
  if (!checkpoint && survivalWaveDescriptor(number).isBoss) {
    kind = run.phase === "in-wave" ? run.lastBossKind : selectSurvivalBossKind({
      waveNumber: number, bossPool: run.bossPool, lastBossKind: run.lastBossKind, strictBossPool: true,
    });
  }
  const boss = kind && V100_BOSSES.find(entry => V100_BATTLE_ADAPTER.BOSS_KIND_BY_V100_ID[entry.id] === kind);
  return { stage: null, boss, label: "出撃準備", number: `第${number}波${checkpoint ? "突破" : ""}` };
}
