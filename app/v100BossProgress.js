import { V100_BOSSES } from "./v100Registry.js";

/** Redundant display flags never establish a Story victory. */
export function v100DiscoveredBosses(receipts) {
  const committed = new Set(Array.isArray(receipts) ? receipts : []);
  return V100_BOSSES.filter(boss => committed.has(boss.firstDefeatReceipt));
}

export function normalizeV100BossProgress(raw, receipts) {
  const discovered = v100DiscoveredBosses(receipts);
  const counts = raw?.defeatCounts && typeof raw.defeatCounts === "object" && !Array.isArray(raw.defeatCounts) ? raw.defeatCounts : {};
  return {
    discoveredIds: discovered.map(boss => boss.id),
    compendiumIds: discovered.map(boss => boss.compendiumId),
    outbreakIds: discovered.map(boss => boss.outbreakId),
    survivalIds: discovered.map(boss => boss.survivalId),
    storyReplayStageNumbers: discovered.map(boss => boss.stageNumber),
    defeatCounts: Object.fromEntries(discovered.map(boss => {
      const value = Number(Object.hasOwn(counts, boss.id) ? counts[boss.id] : 1);
      return [boss.id, Number.isFinite(value) ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))) : 1];
    })),
  };
}
