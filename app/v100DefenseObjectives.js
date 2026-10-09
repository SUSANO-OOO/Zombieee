export const V100_DEFENSE_OBJECTIVES = Object.freeze({
  "stage-sawara-ward-office": Object.freeze({ label: "避難誘導", goal: "避難誘導を守る" }),
  "stage-university-hospital-approach": Object.freeze({ label: "医薬品搬出", goal: "医薬品の搬出を守る" }),
  "stage-civic-archive-route": Object.freeze({ label: "記録搬出", goal: "記録の搬出を守る" }),
  "stage-mugarian-clinical-trial-wing": Object.freeze({ label: "収容室開放", goal: "収容室を順次開放", recordCount: 43 }),
});

// The operation's real defense clock owns progress. Preparation, pausing and
// failed runs cannot advance a separate UI timer or manufacture a completion.
export function v100DefenseStatus(definition, state) {
  const profile = definition.missionConfig?.v100StageNumber
    && definition.missionType === "timed-defense" && V100_DEFENSE_OBJECTIVES[definition.stageId];
  if (!profile) return null;
  const duration = definition.defenseEndAt - definition.prepSeconds;
  const elapsed = Math.max(0, Math.min(duration, state.time - definition.prepSeconds));
  const progress = elapsed / duration;
  const remaining = Math.max(0, Math.ceil(duration - elapsed));
  const clearHp = (state.baseMaxHp || definition.baseMaxHp) * (definition.starThresholds?.[1] ?? 0);
  const failed = state.baseHp <= 0 || (elapsed >= duration && state.baseHp < clearHp);
  const completed = !failed && elapsed >= duration;
  const threatened = state.fighters?.some(fighter => fighter.side === "zombie" && fighter.hp > 0
    && fighter.combatReady === true && fighter.gateEntering !== true && fighter.x < 430);
  const phase = failed ? "failed" : completed ? "success" : state.crawlerHitFlash > 0 ? "impact"
    : threatened ? "incoming" : "perimeter";
  const statusLabel = { failed: "防衛失敗", success: "完了", impact: "被害発生", incoming: "敵接近", perimeter: "防衛中" }[phase];
  const openedRecords = Math.min(profile.recordCount ?? 0, Math.floor(progress * (profile.recordCount ?? 0) + 1e-9));
  return {
    ...profile, phase, statusLabel, progress, remaining, completed, openedRecords,
    objective: profile.recordCount
      ? `${profile.goal} ${openedRecords}/${profile.recordCount}・残り${remaining}秒`
      : `${profile.goal}・残り${remaining}秒`,
  };
}
