import { V100_BOSSES, V100_STAGE_BY_ID, V100_SUPPORTS, V100_UNITS } from "./v100Registry.js";

// Only a durable, finalized result may disclose its rewards or registrations.
export function v100RewardPresentationFor(result) {
  if (result?.won !== true || typeof result.finalizedAt !== "string") return null;
  const stage = V100_STAGE_BY_ID[result.stageId];
  if (!stage) return null;
  const unlocks = result.firstClear ? stage.firstClearPayload.flatMap(id => {
    const unit = V100_UNITS.find(unit => unit.id === id);
    if (unit) return [`${unit.displayName}が合流`];
    const support = V100_SUPPORTS.find(support => support.id === id);
    if (support) return [`${support.displayName}　${support.unlockCostCaps} CAPSで購入可`];
    const boss = V100_BOSSES.find(boss => boss.id === id);
    if (boss) return [`${boss.displayName}を撃破`];
    if (id.startsWith("level-cap-")) return [`レベル上限が${id.slice(10)}に上昇`];
    return [];
  }) : [];
  const rewardCaps = Math.max(0, Number(result.rewardCaps) || 0);
  const breakdown = result.rewardBreakdown;
  const components = ["firstClear", "replay", "star2", "star3"];
  const validBreakdown = breakdown && components.every(key => Number.isSafeInteger(breakdown[key]) && breakdown[key] >= 0)
    && components.reduce((sum, key) => sum + breakdown[key], 0) === rewardCaps;
  const unlockedUnitIds = result.firstClear ? stage.firstClearPayload.filter(id => V100_UNITS.some(unit => unit.id === id)) : [];
  return { stageNumber: stage.number, rewardCaps, unlocks, unlockedUnitIds, breakdown: validBreakdown ? Object.fromEntries(components.map(key => [key, breakdown[key]])) : null };
}
