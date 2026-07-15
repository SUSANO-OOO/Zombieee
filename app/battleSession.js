const PAUSE_ACTION_CONTRACTS = Object.freeze({
  pause: Object.freeze({
    destination: "battle",
    paused: true,
    discardBattleState: false,
    startFreshBattle: false,
    preserveSelection: true,
    commitResult: false,
  }),
  resume: Object.freeze({
    destination: "battle",
    paused: false,
    discardBattleState: false,
    startFreshBattle: false,
    preserveSelection: true,
    commitResult: false,
  }),
  cancel: Object.freeze({
    destination: "pause",
    paused: true,
    discardBattleState: false,
    startFreshBattle: false,
    preserveSelection: true,
    commitResult: false,
  }),
  restart: Object.freeze({
    destination: "battle",
    paused: false,
    discardBattleState: true,
    startFreshBattle: true,
    preserveSelection: true,
    commitResult: false,
  }),
  loadout: Object.freeze({
    destination: "loadout",
    paused: false,
    discardBattleState: true,
    startFreshBattle: false,
    preserveSelection: true,
    commitResult: false,
  }),
  withdraw: Object.freeze({
    destination: "map",
    paused: false,
    discardBattleState: true,
    startFreshBattle: false,
    preserveSelection: true,
    commitResult: false,
  }),
});

let battleReceiptSequence = 0;

export function createBattleResultId(stageId, {
  randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto),
  now = Date.now,
} = {}) {
  if (typeof stageId !== "string" || stageId.length === 0) throw new TypeError("A stage ID is required");
  battleReceiptSequence += 1;
  let entropy = null;
  try {
    entropy = typeof randomUUID === "function" ? randomUUID() : null;
  } catch {
    entropy = null;
  }
  if (typeof entropy !== "string" || entropy.length === 0) {
    const timestamp = typeof now === "function" ? Number(now()) : Date.now();
    entropy = Number.isFinite(timestamp) ? timestamp.toString(36) : Date.now().toString(36);
  }
  // The process-local sequence remains part of the receipt even when a browser
  // UUID is available, so a broken or stubbed UUID source cannot duplicate a
  // retry receipt in the same session.
  return `${stageId}:${entropy}:${battleReceiptSequence.toString(36)}`;
}

export function resolvePauseAction(action) {
  return PAUSE_ACTION_CONTRACTS[action] ?? null;
}

export function createBattleSessionTransition({
  action,
  stageId,
  formationKinds = [],
  selectedSupply,
  campaignSave,
  currentResultId = null,
  createResultId = createBattleResultId,
} = {}) {
  const contract = resolvePauseAction(action);
  if (!contract) return null;
  if (typeof stageId !== "string" || stageId.length === 0) throw new TypeError("A stage ID is required");
  if (!Array.isArray(formationKinds)) throw new TypeError("Formation kinds must be an array");
  return {
    ...contract,
    action,
    stageId,
    formationKinds: [...formationKinds],
    selectedSupply,
    // Pause-menu transitions never create a result receipt. Keeping the exact
    // save reference makes accidental reward/star/unlock writes visible to
    // tests and callers instead of hiding them behind a clone.
    campaignSave,
    resultId: contract.startFreshBattle ? createResultId(stageId) : currentResultId,
  };
}

export const PAUSE_ACTION_IDS = Object.freeze(Object.keys(PAUSE_ACTION_CONTRACTS));
