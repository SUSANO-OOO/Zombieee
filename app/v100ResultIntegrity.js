import { V100_BOSSES, V100_STAGE_BY_ID, V100_STAGE_IDS, v100StarsForVehicle } from "./v100Registry.js";

// Shared by backup acceptance and reward settlement. A restored victory must
// meet the same contract as a victory produced by the battle loop.
export function storyResultIdentity(result) {
  const stage = V100_STAGE_IDS.includes(result?.stageId) ? V100_STAGE_BY_ID[result.stageId] : null;
  const runId = result?.battleRunId;
  if (!stage || result.stageNumber !== stage.number || typeof runId !== "string"
    || runId.length === 0 || runId.length > 256 || runId.trim() !== runId || /[\u0000-\u001f]/.test(runId)
    || (result.resultId !== undefined && result.resultId !== runId)) return null;
  return { stage, runId, receipt: `v100:s${String(stage.number).padStart(2, "0")}:result:${runId}` };
}

export function isSettledStoryResult(save, identity) {
  if (!identity) return false;
  const stagePrefix = `v100:s${String(identity.stage.number).padStart(2, "0")}`;
  // Pre-fix draft saves retain the latest finalized run and explicit replay IDs.
  // Earlier unrecorded first-run IDs cannot be reconstructed from a stage receipt.
  return save.receipts.includes(identity.receipt)
    || save.receipts.includes(`${stagePrefix}:replay:${identity.runId}`)
    || (save.lastResult?.won === true && typeof save.lastResult.finalizedAt === "string"
      && save.lastResult.stageId === identity.stage.id && save.lastResult.battleRunId === identity.runId);
}

export function isValidStoryVictory(result, identity) {
  return Boolean(identity && result.won === true && result.objectiveComplete === true
    && Number.isFinite(result.vehicleHp) && result.vehicleHp > 0
    && Number.isFinite(result.vehicleMaxHp) && result.vehicleMaxHp >= result.vehicleHp
    && result.stars === v100StarsForVehicle({ won: true, vehicleHp: result.vehicleHp, vehicleMaxHp: result.vehicleMaxHp })
    && (!V100_BOSSES.some(boss => boss.stageNumber === identity.stage.number) || result.bossDefeated === true));
}
