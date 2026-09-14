import { V100_BOSSES, V100_STAGE_BY_ID, V100_SUPPORTS, V100_UNITS } from "./v100Registry.js";

// Only a durable, finalized result may disclose its rewards or registrations.
export function v100RewardPresentationFor(result) {
  if (result?.won !== true || typeof result.finalizedAt !== "string") return null;
  const stage = V100_STAGE_BY_ID[result.stageId];
  if (!stage) return null;
  const unlocks = result.firstClear ? stage.firstClearPayload.flatMap(id => {
    const unit = V100_UNITS.find(unit => unit.id === id);
    if (unit) return [`${unit.displayName}の配備登録`];
    const support = V100_SUPPORTS.find(support => support.id === id);
    if (support) return [`${support.displayName}の解禁`];
    const boss = V100_BOSSES.find(boss => boss.id === id);
    if (boss) return [`${boss.displayName}の討伐記録`];
    if (id.startsWith("level-cap-")) return [`育成上限 Lv.${id.slice(10)}`];
    return [];
  }) : [];
  return { stageNumber: stage.number, rewardCaps: Math.max(0, Number(result.rewardCaps) || 0), unlocks };
}
